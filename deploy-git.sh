#!/bin/bash

# Exit on error
set -e

# Configuration
AMPLIFY_APP_ID="d10cf0h8fnfxo5"
AWS_PROFILE="techslice"
BRANCH_NAME="main"

echo "🚀 Starting git-based deployment to Amplify..."
echo "   App ID: $AMPLIFY_APP_ID"
echo "   AWS Profile: $AWS_PROFILE"
echo "   Branch: $BRANCH_NAME"
echo ""

# Check git status
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Warning: You have uncommitted changes."
    echo "   Please commit or stash them before deploying."
    read -p "   Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]; then
    echo "⚠️  Warning: You're on branch '$CURRENT_BRANCH', not '$BRANCH_NAME'."
    read -p "   Switch to $BRANCH_NAME? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        git checkout $BRANCH_NAME
    fi
fi

# Push to remote
echo "📤 Pushing to remote..."
git push origin $BRANCH_NAME

# Trigger Amplify build
echo "🔨 Triggering Amplify build..."
BUILD_ID=$(aws amplify start-job \
    --app-id $AMPLIFY_APP_ID \
    --branch-name $BRANCH_NAME \
    --job-type RELEASE \
    --profile $AWS_PROFILE \
    --query 'jobSummary.jobId' \
    --output text)

echo "   Build ID: $BUILD_ID"

# Monitor build status
echo "📊 Monitoring build status..."
while true; do
    STATUS=$(aws amplify get-job \
        --app-id $AMPLIFY_APP_ID \
        --branch-name $BRANCH_NAME \
        --job-id $BUILD_ID \
        --profile $AWS_PROFILE \
        --query 'job.summary.status' \
        --output text)
    
    echo -ne "\r   Status: $STATUS"
    
    if [ "$STATUS" = "SUCCEED" ]; then
        echo ""
        echo "✅ Deployment successful!"
        
        # Get the app URL
        APP_URL=$(aws amplify get-branch \
            --app-id $AMPLIFY_APP_ID \
            --branch-name $BRANCH_NAME \
            --profile $AWS_PROFILE \
            --query 'branch.displayName' \
            --output text)
        
        echo "   Your app is available at: https://$BRANCH_NAME.$AMPLIFY_APP_ID.amplifyapp.com/"
        break
    elif [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "CANCELLED" ]; then
        echo ""
        echo "❌ Deployment failed with status: $STATUS"
        echo "   Check the Amplify console for details."
        exit 1
    fi
    
    sleep 5
done