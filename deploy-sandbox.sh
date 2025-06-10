#!/bin/bash

# Exit on error
set -e

# Configuration
AMPLIFY_APP_ID="d10cf0h8fnfxo5"
AWS_PROFILE="techslice"
BRANCH_NAME="main"

echo "🚀 Starting deployment to Amplify sandbox..."
echo "   App ID: $AMPLIFY_APP_ID"
echo "   AWS Profile: $AWS_PROFILE"
echo "   Branch: $BRANCH_NAME"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if the profile exists
if ! aws configure list-profiles | grep -q "^${AWS_PROFILE}$"; then
    echo "❌ AWS profile '$AWS_PROFILE' not found."
    echo "   Available profiles:"
    aws configure list-profiles
    exit 1
fi

# Generate Amplify outputs if not present
if [ ! -f "amplify_outputs.json" ]; then
    echo "📦 Generating amplify_outputs.json..."
    npx ampx generate outputs --profile=$AWS_PROFILE
fi

# Build the application
echo "🔨 Building the application..."
npm run build

# Deploy to Amplify sandbox
echo "☁️  Starting Amplify sandbox..."
npx ampx sandbox --profile=$AWS_PROFILE

echo ""
echo "✅ Deployment complete!"
echo "   Your app should be available at the Amplify sandbox URL."