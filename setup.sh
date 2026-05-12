#!/bin/bash

# Portfolio Setup Script - Personalize Your Clone
# This script helps you quickly customize this portfolio for your own use

echo "================================"
echo "Portfolio Setup Script"
echo "================================"
echo ""
echo "This script will help you personalize this portfolio for your use."
echo "Follow the prompts below to customize the portfolio with your information."
echo ""

# Collect user information
read -p "Enter your full name (e.g., John Doe): " USER_NAME
read -p "Enter your website URL (e.g., www.example.com): " WEBSITE_URL
read -p "Enter your GitHub username (e.g., yourusername): " GITHUB_USERNAME
read -p "Enter your LinkedIn profile URL (e.g., linkedin.com/in/yourprofile): " LINKEDIN_URL
read -p "Enter your email address: " EMAIL_ADDRESS
read -p "Enter your blog URL (e.g., yourblog.blogspot.com): " BLOG_URL

echo ""
echo "================================"
echo "Updating files with your information..."
echo "================================"
echo ""

# Function to replace text in files
replace_in_file() {
    local file=$1
    local old_text=$2
    local new_text=$3
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|$old_text|$new_text|g" "$file"
    else
        # Linux
        sed -i "s|$old_text|$new_text|g" "$file"
    fi
}

# Update index.html
echo "Updating index.html..."
replace_in_file "index.html" "Sayad md Bayezid Hosan" "$USER_NAME"
replace_in_file "index.html" "www.sayadbayezid.com" "$WEBSITE_URL"
replace_in_file "index.html" "github.com/bayzed123" "github.com/$GITHUB_USERNAME"
replace_in_file "index.html" "linkedin.com/in/sayadbayezid" "$LINKEDIN_URL"

# Update blog.html
echo "Updating blog.html..."
replace_in_file "blog.html" "Sayad md Bayezid Hosan" "$USER_NAME"
replace_in_file "blog.html" "www.sayadbayezid.com" "$WEBSITE_URL"
replace_in_file "blog.html" "github.com/bayzed123" "github.com/$GITHUB_USERNAME"
replace_in_file "blog.html" "linkedin.com/in/sayadbayezid" "$LINKEDIN_URL"

# Update blog-loader.html
echo "Updating blog-loader.html..."
replace_in_file "blog-loader.html" "Sayad md Bayezid Hosan" "$USER_NAME"
replace_in_file "blog-loader.html" "www.sayadbayezid.com" "$WEBSITE_URL"
replace_in_file "blog-loader.html" "github.com/bayzed123" "github.com/$GITHUB_USERNAME"
replace_in_file "blog-loader.html" "linkedin.com/in/sayadbayezid" "$LINKEDIN_URL"

# Update README.md
echo "Updating README.md..."
replace_in_file "README.md" "Sayad Md Bayezid Hosan" "$USER_NAME"
replace_in_file "README.md" "www.sayadbayezid.com" "$WEBSITE_URL"
replace_in_file "README.md" "github.com/bayzed123" "github.com/$GITHUB_USERNAME"
replace_in_file "README.md" "linkedin.com/in/sayadbayezid" "$LINKEDIN_URL"

# Update LICENSE
echo "Updating LICENSE..."
replace_in_file "LICENSE" "Sayad Md Bayezid Hosan" "$USER_NAME"
replace_in_file "LICENSE" "https://www.sayadbayezid.com" "https://$WEBSITE_URL"

# Update scripts/convert_blogs.py
echo "Updating scripts/convert_blogs.py..."
replace_in_file "scripts/convert_blogs.py" "Sayad Md Bayezid Hosan" "$USER_NAME"

echo ""
echo "================================"
echo "✅ Setup Complete!"
echo "================================"
echo ""
echo "Your portfolio has been personalized with the following information:"
echo "  Name: $USER_NAME"
echo "  Website: $WEBSITE_URL"
echo "  GitHub: github.com/$GITHUB_USERNAME"
echo "  LinkedIn: $LINKEDIN_URL"
echo "  Email: $EMAIL_ADDRESS"
echo "  Blog: $BLOG_URL"
echo ""
echo "Next steps:"
echo "1. Review the changes in your HTML files"
echo "2. Update the footer credit if needed: index.html (line ~1102)"
echo "3. Add your own projects and content"
echo "4. Test the blog system by adding a post to blog_uploads/"
echo "5. Deploy to your hosting provider"
echo ""
echo "For detailed instructions, see:"
echo "  - README.md (Quick Start Guide)"
echo "  - WIKI.md (Complete Technical Guide)"
echo ""
echo "Happy coding! 🚀"
