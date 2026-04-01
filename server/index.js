import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = 5000;

app.use(cors());

/**
 * Proxy endpoint for IPTV streams
 * Example: /api/stream?url=https://example.com/stream.m3u8
 */

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 8000);

app.get("/api/stream", async (req, res) => {
    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).json({ error: "Missing stream URL" });
        }

        console.log("Proxying:", url);

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Referer": url,
                "Origin": url
            },
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return res.status(response.status).send("Stream fetch failed");
        }

        // Important headers
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Access-Control-Allow-Origin", "*");

        response.body.pipe(res);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Proxy error" });
    }
});

// /Waking up from Sleep in Render
app.get("/api/wake-up", (req, res) => {
    res.status(200).send("Waking up...");
    console.log("Received wake-up call, keeping the server alive.");
});

app.listen(PORT, () => {
    console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
});