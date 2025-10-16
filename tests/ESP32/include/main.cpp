#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <Wire.h>
#include <Adafruit_MLX90640.h>

// --- GAS SENSOR PINS & DIVIDER ---
#define MQ135_PIN 33
#define MQ9_PIN   25

const float R1 = 10000.0;   // 10k
const float R2 = 15000.0;   // 15k
const float DIVIDER_FACTOR = (R1 + R2) / R2;

const float ADC_REF = 3.3;    
const int ADC_MAX = 4095;     
const float VSENSOR_MAX = 5.0;

// --- THERMAL SENSOR ---
#define SDA_PIN 21
#define SCL_PIN 22

Adafruit_MLX90640 mlx;
float frame[32 * 24];

// --- WIFI & SERVER ---
const char* ssid = "Argus";
const char* password = "12345678";

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

// --- UTILITY FUNCTIONS ---
float readVoltage(int pin) {
  int raw = analogRead(pin);
  float v_adc = (raw / (float)ADC_MAX) * ADC_REF;
  float v_sensor = v_adc * DIVIDER_FACTOR;
  return v_sensor;
}

// --- SEND DATA TO CLIENTS ---
void notifyClients() {
  // Gas values
  float v135 = readVoltage(MQ135_PIN);
  float v9   = readVoltage(MQ9_PIN);

  float p135 = constrain((v135 / VSENSOR_MAX) * 100.0, 0, 100);
  float p9   = constrain((v9   / VSENSOR_MAX) * 100.0, 0, 100);

  String gasPayload = "{";
  gasPayload += "\"type\":\"gas\",";
  gasPayload += "\"mq135_pct\":" + String(p135, 1) + ",";
  gasPayload += "\"mq9_pct\":" + String(p9, 1);
  gasPayload += "}";

  ws.textAll(gasPayload);

  // Thermal camera
  if (mlx.getFrame(frame) == 0) {  // success
    String thermalPayload = "{ \"type\":\"thermal\", \"data\":[";
    for (int i = 0; i < 32*24; i++) {
      thermalPayload += String(frame[i], 1);
      if (i < 32*24 - 1) thermalPayload += ",";
    }
    thermalPayload += "]}";
    ws.textAll(thermalPayload);
  }
}

// --- WEBSOCKET CALLBACK ---
void onWsEvent(AsyncWebSocket * server, AsyncWebSocketClient * client,
               AwsEventType type, void * arg, uint8_t *data, size_t len) {
    if(type == WS_EVT_CONNECT){
        Serial.println("WebSocket client connected");
    } else if(type == WS_EVT_DISCONNECT){
        Serial.println("WebSocket client disconnected");
    } else if(type == WS_EVT_DATA){
        // optional: handle commands from JS if needed
    }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  // --- ADC Setup ---
  analogSetWidth(12);
  analogSetPinAttenuation(MQ135_PIN, ADC_11db);
  analogSetPinAttenuation(MQ9_PIN,   ADC_11db);

  // --- WIFI AP ---
  WiFi.softAP(ssid, password);
  Serial.print("AP IP: ");
  Serial.println(WiFi.softAPIP());

  // --- WEBSOCKET ---
  ws.onEvent(onWsEvent);
  server.addHandler(&ws);

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(200, "text/plain", "Argus Bot WebSocket Server");
  });

  server.begin();
  Serial.println("Server started, WebSocket ready");

  // --- THERMAL SENSOR INIT ---
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(600000);

  delay(2000);
  while (!mlx.begin(MLX90640_I2CADDR_DEFAULT, &Wire)) {
    Serial.println("MLX90640 not found, retrying...");
    delay(1000);
  }
  Serial.println("MLX90640 initialized successfully!");
  mlx.setRefreshRate(MLX90640_8_HZ);
}

void loop() {
  ws.cleanupClients();   // maintain WS
  notifyClients();       // send gas & thermal
  delay(250);            // thermal 8Hz ≈ 125ms, safe delay
}
