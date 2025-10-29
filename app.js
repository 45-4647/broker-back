import express from "express";


export function createApp() {
  const app = express();
  
app.get("/api/ping", (req, res) => {
  res.status(200).json({ message: "pong" });
});

app.get("/api/products", (req, res) => {
  res.status(200).json([
    { id: 1, name: "Laptop" },
    { id: 2, name: "Phone" }
  ]);
});
  return app;
}
