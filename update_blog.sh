#!/bin/bash

echo "🚀 Starting Blog Update Process..."

# Step 1: Convert HTML to JSON
echo "📦 Converting HTML files to Blog JSON..."
python3 scripts/convert_blogs.py

# Step 2: Git operations
echo "💾 Saving changes to GitHub..."
git add .
git commit -m "Auto-update blog: $(date +'%Y-%m-%d %H:%M:%S')"
git push origin main

echo "✅ Blog Update Complete! Your new posts are now live."
