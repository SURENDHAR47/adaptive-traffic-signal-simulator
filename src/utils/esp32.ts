import { LaneId, SignalState } from '../types/traffic';

export interface ESP32Signal {
  laneId: LaneId;
  state: SignalState;
  timeRemaining: number;
}

/**
 * Send signal state to ESP32-CAM via HTTP GET request
 * Endpoint: http://{ip}/signal?lane={N|S|E|W}&state={red|green|yellow}&time={seconds}
 */
export async function sendSignalToESP32(
  ip: string,
  signal: ESP32Signal
): Promise<boolean> {
  try {
    const url = `http://${ip}/signal?lane=${signal.laneId}&state=${signal.state}&time=${signal.timeRemaining}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      mode: 'no-cors',
    });
    clearTimeout(timeout);
    return true;
  } catch (err) {
    console.warn('ESP32 communication error:', err);
    return false;
  }
}

/**
 * Ping ESP32 to check connectivity
 * Endpoint: http://{ip}/ping
 */
export async function pingESP32(ip: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    await fetch(`http://${ip}/ping`, {
      method: 'GET',
      signal: controller.signal,
      mode: 'no-cors',
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate Arduino/ESP32 code snippet for the user
 */
export function getESP32ArduinoCode(): string {
  return `
// ESP32-CAM Traffic Signal Controller
// Flash this to your ESP32-CAM module

#include <WiFi.h>
#include <WebServer.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// GPIO Pins for LEDs (adjust to your wiring)
// Lane N: Red=12, Green=13
// Lane S: Red=14, Green=15
// Lane E: Red=2,  Green=4
// Lane W: Red=16, Green=17
int RED_PINS[]   = {12, 14, 2, 16};
int GREEN_PINS[] = {13, 15, 4, 17};
String LANES[]   = {"N", "S", "E", "W"};

WebServer server(80);

void setSignal(String lane, String state) {
  for (int i = 0; i < 4; i++) {
    if (LANES[i] == lane) {
      if (state == "green") {
        digitalWrite(RED_PINS[i], LOW);
        digitalWrite(GREEN_PINS[i], HIGH);
      } else {
        digitalWrite(RED_PINS[i], HIGH);
        digitalWrite(GREEN_PINS[i], LOW);
      }
    }
  }
}

void handleSignal() {
  String lane  = server.arg("lane");
  String state = server.arg("state");
  String time  = server.arg("time");
  setSignal(lane, state);
  server.send(200, "text/plain", "OK lane=" + lane + " state=" + state);
}

void handlePing() {
  server.send(200, "text/plain", "PONG");
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 4; i++) {
    pinMode(RED_PINS[i], OUTPUT);
    pinMode(GREEN_PINS[i], OUTPUT);
    digitalWrite(RED_PINS[i], HIGH);
    digitalWrite(GREEN_PINS[i], LOW);
  }
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println("IP: " + WiFi.localIP().toString());
  server.on("/signal", handleSignal);
  server.on("/ping",   handlePing);
  server.begin();
}

void loop() {
  server.handleClient();
}
`;
}
