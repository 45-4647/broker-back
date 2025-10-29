import request from "supertest";
import { createApp } from "../app.js";
// import "../__tests__/setup.js"; // mock DB

describe("API Endpoints", () => {
  let app;

  beforeAll(() => {
    app = createApp(); // Create app instance for testing
  });

  describe("GET /api/ping", () => {
    it("should return pong", async () => {
      const res = await request(app).get("/api/ping");
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("pong");
    });
  });

  describe("GET /api/products", () => {
    it("should return list of products", async () => {
      const res = await request(app).get("/api/products");
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty("name", "Laptop");
    });
  });
});
