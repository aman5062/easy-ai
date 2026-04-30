#!/bin/bash

echo "🧠 Setting up easy-ai..."
echo ""

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 18+ required. You have: $(node -v)"
  exit 1
fi

echo "✓ Node.js version OK"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Build
echo ""
echo "🔨 Building package..."
npm run build

# Run test
echo ""
echo "🧪 Running tests..."
npm test

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Set your OpenAI API key:"
echo "     export OPENAI_API_KEY='your-key-here'"
echo ""
echo "  2. Use the CLI:"
echo "     npm link"
echo "     easy-ai ask 'What is AI?'"
echo ""
echo "Happy building! 🚀"
