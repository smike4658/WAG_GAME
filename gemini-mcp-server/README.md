# Gemini MCP Server

MCP server for Google Gemini API - supports Imagen 4 image generation and Gemini multimodal capabilities.

## Features

- **imagen-generate**: Generate images using Imagen 4 model (up to 4 images, 1K/2K resolution)
- **gemini-image-generate**: Generate/edit images using Gemini 2.5 Flash (Nano Banana)
- **gemini-analyze-image**: Analyze images using Gemini's vision capabilities

## Setup

### 1. Get your API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key

### 2. Add to Claude Code Configuration

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "node",
      "args": ["/Users/michalsvondr/WAG_GAME/gemini-mcp-server/build/index.js"],
      "env": {
        "GEMINI_API_KEY": "YOUR_API_KEY_HERE",
        "GEMINI_OUTPUT_DIR": "/Users/michalsvondr/WAG_GAME/assets/generated"
      }
    }
  }
}
```

### 3. Restart Claude Code

After adding the configuration, restart Claude Code to load the new MCP server.

## Usage Examples

### Generate image with Imagen 4

```
Use imagen-generate with prompt "Low-poly office worker in business suit, scared expression, game asset style"
```

### Generate/edit image with Gemini

```
Use gemini-image-generate with prompt "Create a seamless brick texture for a building"
```

### Analyze an image

```
Use gemini-analyze-image with imagePath "/path/to/image.png" and prompt "What style is this 3D model?"
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Your Google AI API key | Required |
| `GEMINI_OUTPUT_DIR` | Directory for saved images | `./assets/generated` |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev
```
