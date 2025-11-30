#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
// Configuration
const API_KEY = process.env.GEMINI_API_KEY || "";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_OUTPUT_DIR = process.env.GEMINI_OUTPUT_DIR || "./assets/generated";
// Tool definitions
const tools = [
    {
        name: "imagen-generate",
        description: "Generate images using Google Imagen 4 model. Best for creating new images from text descriptions. Supports up to 4 images at once.",
        inputSchema: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    description: "Text description of the image to generate (max 480 tokens, English only). Be descriptive about style, colors, composition.",
                },
                numberOfImages: {
                    type: "number",
                    description: "Number of images to generate (1-4, default: 1)",
                    minimum: 1,
                    maximum: 4,
                },
                aspectRatio: {
                    type: "string",
                    enum: ["1:1", "3:4", "4:3", "9:16", "16:9"],
                    description: "Aspect ratio of generated images (default: 1:1)",
                },
                imageSize: {
                    type: "string",
                    enum: ["1K", "2K"],
                    description: "Resolution: 1K (1024px) or 2K (2048px). Default: 1K",
                },
                outputDir: {
                    type: "string",
                    description: `Directory to save images (default: ${DEFAULT_OUTPUT_DIR})`,
                },
                filename: {
                    type: "string",
                    description: "Base filename for saved images (without extension). Timestamp will be added.",
                },
            },
            required: ["prompt"],
        },
    },
    {
        name: "gemini-image-generate",
        description: "Generate images using Gemini 2.5 Flash (Nano Banana) model. Supports conversational image generation and editing with context.",
        inputSchema: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    description: "Text description or instruction for image generation/editing. Can reference previous context.",
                },
                inputImagePath: {
                    type: "string",
                    description: "Optional path to an input image for editing or reference.",
                },
                outputDir: {
                    type: "string",
                    description: `Directory to save the image (default: ${DEFAULT_OUTPUT_DIR})`,
                },
                filename: {
                    type: "string",
                    description: "Filename for saved image (without extension).",
                },
            },
            required: ["prompt"],
        },
    },
    {
        name: "gemini-analyze-image",
        description: "Analyze an image using Gemini's vision capabilities. Returns text description and analysis.",
        inputSchema: {
            type: "object",
            properties: {
                imagePath: {
                    type: "string",
                    description: "Path to the image file to analyze",
                },
                prompt: {
                    type: "string",
                    description: "Question or instruction about the image (default: 'Describe this image in detail')",
                },
            },
            required: ["imagePath"],
        },
    },
];
// Helper functions
function ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function generateFilename(base, index, ext) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const suffix = index > 0 ? `_${index + 1}` : "";
    return `${base}_${timestamp}${suffix}.${ext}`;
}
async function saveBase64Image(base64Data, outputPath) {
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(outputPath, buffer);
}
function readImageAsBase64(imagePath) {
    const buffer = fs.readFileSync(imagePath);
    return buffer.toString("base64");
}
function getMimeType(imagePath) {
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    };
    return mimeTypes[ext] || "image/png";
}
// API functions
async function generateWithImagen(params) {
    if (!API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is not set. Please set it to your Google AI API key.");
    }
    const url = `${BASE_URL}/models/imagen-4.0-generate-001:predict?key=${API_KEY}`;
    const body = {
        instances: [{ prompt: params.prompt }],
        parameters: {
            numberOfImages: params.numberOfImages || 1,
            aspectRatio: params.aspectRatio || "1:1",
            imageSize: params.imageSize || "1K",
        },
    };
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = (await response.json());
    if (data.error) {
        throw new Error(`Imagen API error: ${data.error.message}`);
    }
    if (!data.predictions || data.predictions.length === 0) {
        throw new Error("No images generated");
    }
    // Save images
    const outputDir = params.outputDir || DEFAULT_OUTPUT_DIR;
    ensureDirectoryExists(outputDir);
    const savedPaths = [];
    const baseName = params.filename || "imagen";
    for (let i = 0; i < data.predictions.length; i++) {
        const prediction = data.predictions[i];
        const filename = generateFilename(baseName, i, "png");
        const outputPath = path.join(outputDir, filename);
        await saveBase64Image(prediction.bytesBase64Encoded, outputPath);
        savedPaths.push(outputPath);
    }
    return savedPaths;
}
async function generateWithGemini(params) {
    if (!API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is not set. Please set it to your Google AI API key.");
    }
    const url = `${BASE_URL}/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`;
    const parts = [{ text: params.prompt }];
    // Add input image if provided
    if (params.inputImagePath && fs.existsSync(params.inputImagePath)) {
        const imageData = readImageAsBase64(params.inputImagePath);
        const mimeType = getMimeType(params.inputImagePath);
        parts.unshift({
            inlineData: {
                mimeType,
                data: imageData,
            },
        });
    }
    const body = {
        contents: [{ parts }],
        generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
        },
    };
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = (await response.json());
    if (data.error) {
        throw new Error(`Gemini API error: ${data.error.message}`);
    }
    if (!data.candidates || data.candidates.length === 0) {
        throw new Error("No response generated");
    }
    // Find image in response
    const candidate = data.candidates[0];
    let savedPath = null;
    let textResponse = "";
    for (const part of candidate.content.parts) {
        if (part.inlineData) {
            const outputDir = params.outputDir || DEFAULT_OUTPUT_DIR;
            ensureDirectoryExists(outputDir);
            const baseName = params.filename || "gemini";
            const ext = part.inlineData.mimeType.includes("png") ? "png" : "jpg";
            const filename = generateFilename(baseName, 0, ext);
            const outputPath = path.join(outputDir, filename);
            await saveBase64Image(part.inlineData.data, outputPath);
            savedPath = outputPath;
        }
        if (part.text) {
            textResponse += part.text;
        }
    }
    return savedPath;
}
async function analyzeWithGemini(imagePath, prompt) {
    if (!API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is not set. Please set it to your Google AI API key.");
    }
    if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
    }
    const url = `${BASE_URL}/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`;
    const imageData = readImageAsBase64(imagePath);
    const mimeType = getMimeType(imagePath);
    const body = {
        contents: [
            {
                parts: [
                    {
                        inlineData: {
                            mimeType,
                            data: imageData,
                        },
                    },
                    {
                        text: prompt || "Describe this image in detail",
                    },
                ],
            },
        ],
    };
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = (await response.json());
    if (data.error) {
        throw new Error(`Gemini API error: ${data.error.message}`);
    }
    if (!data.candidates || data.candidates.length === 0) {
        throw new Error("No response generated");
    }
    const textParts = data.candidates[0].content.parts
        .filter((p) => p.text)
        .map((p) => p.text);
    return textParts.join("\n");
}
// MCP Server setup
const server = new Server({
    name: "gemini-mcp-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
});
// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "imagen-generate": {
                const params = args;
                const savedPaths = await generateWithImagen(params);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Generated ${savedPaths.length} image(s):\n${savedPaths.join("\n")}\n\nPrompt: "${params.prompt}"`,
                        },
                    ],
                };
            }
            case "gemini-image-generate": {
                const params = args;
                const savedPath = await generateWithGemini(params);
                if (savedPath) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Generated image saved to: ${savedPath}\n\nPrompt: "${params.prompt}"`,
                            },
                        ],
                    };
                }
                else {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Gemini responded but no image was generated. The model may have provided a text response instead.`,
                            },
                        ],
                    };
                }
            }
            case "gemini-analyze-image": {
                const { imagePath, prompt } = args;
                const analysis = await analyzeWithGemini(imagePath, prompt || "Describe this image in detail");
                return {
                    content: [
                        {
                            type: "text",
                            text: analysis,
                        },
                    ],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${errorMessage}`,
                },
            ],
            isError: true,
        };
    }
});
// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Gemini MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
