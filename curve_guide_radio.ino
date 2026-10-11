/*
  Curve Guide + Car Detection (ESP32, NEO-6M GPS, SSD1306 OLED, buzzer)

  WIRING (same as before)
    3V3 -> GPS VCC, OLED VCC, buzzer VCC      GND -> all GND
    GPIO 21 -> OLED SDA      GPIO 22 -> OLED SCL
    GPIO 16 -> GPS TX        GPIO 17 -> GPS RX
    GPIO 25 -> buzzer I/O

  LIBRARIES: TinyGPSPlus, Adafruit SSD1306, Adafruit GFX Library
  (WiFi and ESP-NOW come built into the ESP32 board package.)
  BOARD: "ESP32 Dev Module"

  HOW CAR DETECTION WORKS
    Every second each device broadcasts: id, position, speed, heading.
    Every device also listens. If another car is within ALERT_M metres and
    getting closer, the screen shows CAR COMING and the buzzer beeps fast.
    Both cars must run this same code.
*/
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <TinyGPSPlus.h>
#include <WiFi.h>
#include <esp_now.h>

#define SIM_MODE 1        // 1 = fake speed, curve and car (desk test). Set 0 for the car.
#define BUZZER_PIN 25
#define BUZZER_ON  LOW    // low-level-trigger module: LOW = sound. Swap if yours is opposite.
#define BUZZER_OFF HIGH
#define GPS_RX 16
#define GPS_TX 17

const float LAT_ACCEL = 2.5;   // comfortable sideways acceleration, m/s^2
const float LOOK_M    = 350;   // curve look-ahead, metres
const float CONE_DEG  = 45;    // curve must be within this angle of your heading
const float ALERT_M   = 100;   // car alert distance, metres
const unsigned long CAR_TIMEOUT_MS = 3000;  // forget a car after this long with no message
const uint32_t MAGIC = 0xC47E0001;          // marks our messages

struct Curve { double lat, lon; float radius; };
// Replace with real curve points: latitude, longitude, estimated radius in metres.
Curve curves[] = {
  {0.0, 0.0, 80},
};
const int N = sizeof(curves) / sizeof(curves[0]);

struct __attribute__((packed)) Packet { uint32_t magic; uint32_t id; double lat; double lon; float kmh; float hdg; };
struct Other { uint32_t id; double lat, lon; float kmh, hdg; unsigned long seen; };
Other others[8];
uint32_t myId;

Adafruit_SSD1306 oled(128, 64, &Wire, -1);
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
bool over = false, carAlert = false;
unsigned long lastDraw = 0, lastSend = 0;

// ---------- radio ----------
void storePacket(const uint8_t *data, int len) {
  if (len != (int)sizeof(Packet)) return;
  Packet p;
  memcpy(&p, data, sizeof(p));
  if (p.magic != MAGIC || p.id == myId) return;
  int slot = -1;
  for (int i = 0; i < 8; i++) if (others[i].seen && others[i].id == p.id) { slot = i; break; }
  if (slot < 0) for (int i = 0; i < 8; i++)
    if (!others[i].seen || millis() - others[i].seen > CAR_TIMEOUT_MS) { slot = i; break; }
  if (slot < 0) slot = 0;
  others[slot] = {p.id, p.lat, p.lon, p.kmh, p.hdg, millis()};
}

#if ESP_ARDUINO_VERSION_MAJOR >= 3
void onRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) { storePacket(data, len); }
#else
void onRecv(const uint8_t *mac, const uint8_t *data, int len) { storePacket(data, len); }
#endif

void sendPing(double lat, double lon, float kmh, float hdg) {
  Packet p = {MAGIC, myId, lat, lon, kmh, hdg};
  uint8_t bc[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
  esp_now_send(bc, (uint8_t *)&p, sizeof(p));
}

// Nearest car within ALERT_M that is getting closer.
bool findCar(double lat, double lon, float kmh, double hdg, float &dist) {
  bool found = false;
  dist = ALERT_M + 1;
  float v = (kmh > 3) ? kmh / 3.6 : 0;
  double mvx = v * sin(radians(hdg)), mvy = v * cos(radians(hdg));
  for (int i = 0; i < 8; i++) {
    Other &o = others[i];
    if (!o.seen || millis() - o.seen > CAR_TIMEOUT_MS) continue;
    double d = TinyGPSPlus::distanceBetween(lat, lon, o.lat, o.lon);
    if (d > ALERT_M || d < 1) continue;
    double brg = radians(TinyGPSPlus::courseTo(lat, lon, o.lat, o.lon));
    double dx = d * sin(brg), dy = d * cos(brg);
    float ov = (o.kmh > 3) ? o.kmh / 3.6 : 0;
    double rvx = ov * sin(radians(o.hdg)) - mvx, rvy = ov * cos(radians(o.hdg)) - mvy;
    double closing = -(dx * rvx + dy * rvy) / d;   // metres per second, positive = getting closer
    if (closing > 1.0 && d < dist) { dist = d; found = true; }
  }
  return found;
}

// ---------- curves ----------
bool findCurve(double lat, double lon, double hdg, float &d, float &r) {
  bool found = false;
  d = LOOK_M;
  for (int i = 0; i < N; i++) {
    double dd = TinyGPSPlus::distanceBetween(lat, lon, curves[i].lat, curves[i].lon);
    if (dd > LOOK_M) continue;
    double brg = TinyGPSPlus::courseTo(lat, lon, curves[i].lat, curves[i].lon);
    double diff = fabs(fmod(brg - hdg + 540.0, 360.0) - 180.0);
    if (diff <= CONE_DEG && dd < d) { d = dd; r = curves[i].radius; found = true; }
  }
  return found;
}

// ---------- buzzer ----------
void handleBeep() {
  bool on = false;
  if (carAlert) on = (millis() % 400) < 150;      // fast beeps = car coming
  else if (over) on = (millis() % 1000) < 150;    // slow beeps = too fast for curve
  digitalWrite(BUZZER_PIN, on ? BUZZER_ON : BUZZER_OFF);
}

void setup() {
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, BUZZER_OFF);
  Wire.begin(21, 22);
  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { while (true) delay(1000); }
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  myId = (uint32_t)ESP.getEfuseMac();

  WiFi.mode(WIFI_STA);
  if (esp_now_init() == ESP_OK) {
    esp_now_register_recv_cb(onRecv);
    esp_now_peer_info_t peer = {};
    memset(peer.peer_addr, 0xFF, 6);
    peer.channel = 0;
    peer.encrypt = false;
    esp_now_add_peer(&peer);
  }

  oled.clearDisplay();
  oled.setTextColor(WHITE);
  oled.setTextSize(2);
  oled.setCursor(0, 20);
  oled.print("Curve guide");
  oled.display();
  delay(1200);
}

void loop() {
  while (gpsSerial.available()) gps.encode(gpsSerial.read());
  handleBeep();
  if (millis() - lastDraw < 250) return;
  lastDraw = millis();

  float kmh = 0, d = 0, r = 0, carD = 0;
  bool fix = false, found = false, car = false;

#if SIM_MODE
  unsigned long t = (millis() / 1000) % 20;
  kmh = 30 + t * 3.0; d = 300 - t * 14; r = 60; fix = true; found = true;
  carD = 150 - t * 7; car = carD < ALERT_M;
#else
  fix = gps.location.isValid() && gps.location.age() < 3000;
  if (fix) {
    double lat = gps.location.lat(), lon = gps.location.lng();
    kmh = gps.speed.kmph();
    double hdg = (kmh > 3 && gps.course.isValid()) ? gps.course.deg() : 0;
    if (kmh > 3 && gps.course.isValid()) found = findCurve(lat, lon, hdg, d, r);
    car = findCar(lat, lon, kmh, hdg, carD);
    if (millis() - lastSend >= 1000) { lastSend = millis(); sendPing(lat, lon, kmh, hdg); }
  }
#endif

  float safeKmh = found ? sqrt(LAT_ACCEL * r) * 3.6 : 0;
  over = found && kmh > safeKmh;
  carAlert = car;

  oled.clearDisplay();
  oled.setTextColor(WHITE);
  if (!fix) {
    oled.setTextSize(1);
    oled.setCursor(0, 12); oled.print("Waiting for GPS...");
    oled.setCursor(0, 28); oled.print("Satellites: "); oled.print(gps.satellites.value());
  } else {
    oled.setTextSize(3);
    oled.setCursor(0, 0); oled.print((int)kmh);
    oled.setTextSize(1);
    oled.setCursor(66, 14); oled.print("km/h");
    oled.setCursor(0, 32);
    if (carAlert) { oled.print("Car "); oled.print((int)carD); oled.print(" m away"); }
    else if (found) { oled.print("Curve in "); oled.print((int)d); oled.print(" m"); }
    else oled.print("Road clear");
    if (carAlert || over) {
      oled.fillRect(0, 44, 128, 20, WHITE);
      oled.setTextColor(BLACK);
      oled.setTextSize(2);
      oled.setCursor(4, 47); oled.print(carAlert ? "CAR COMING" : "SLOW DOWN");
    } else if (found) {
      oled.setCursor(0, 46); oled.print("Safe speed "); oled.print((int)safeKmh);
    }
  }
  oled.display();
}
