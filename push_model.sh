#!/bin/bash
# push_model.sh — Pushes the Gemma GGUF model directly to the app's external files directory.
# The app always has read access to this location (no Android permission issues).
#
# Usage: ./push_model.sh

set -e

MODEL_FILE="models/gemma.gguf"
PACKAGE="com.crisisnet"
DEST="/sdcard/Android/data/$PACKAGE/files/gemma.gguf"

if [ ! -f "$MODEL_FILE" ]; then
  echo "❌ Model not found at $MODEL_FILE"
  echo "   Place your gemma.gguf file in the models/ directory first."
  exit 1
fi

LOCAL_SIZE=$(wc -c < "$MODEL_FILE" | tr -d ' ')
echo "📦 Pushing model ($((LOCAL_SIZE / 1048576)) MB) directly to app storage..."
echo "   This takes ~20-30 seconds..."
adb push "$MODEL_FILE" "$DEST"

DEVICE_SIZE=$(adb shell "wc -c < $DEST" | tr -d '\r')
if [ "$LOCAL_SIZE" = "$DEVICE_SIZE" ]; then
  echo ""
  echo "✅ Done! Model deployed successfully."
  echo "   Size verified: $DEVICE_SIZE bytes"
  echo "   Open the Ask AI tab in the app to start using it."
else
  echo ""
  echo "❌ Size mismatch! Local=$LOCAL_SIZE Device=$DEVICE_SIZE"
  echo "   The file may be corrupted. Try again."
  exit 1
fi
