import { Express } from "express";
import { copyGCSFolder } from "./aws";
import express from "express";

export function initHttp(app: Express) {
    app.use(express.json());

    app.post("/project", async (req, res) => {
        // Hit a database to ensure this slug isn't taken already
        const { replId, language } = req.body;

        if (!replId) {
            res.status(400).send("Bad request");
            return;
        }

        await copyGCSFolder(`base/${language}`, `code/${replId}`);

        res.send("Project created");
    });
}