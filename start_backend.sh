#!/bin/bash
cd backend
if [ ! -d venv ]; then
  echo "Creating virtual environment..."
  python -m venv venv
  echo "Installing dependencies..."
  ./venv/Scripts/pip install -q -r requirements.txt
fi
echo "Starting FastAPI server..."
./venv/Scripts/uvicorn main:app --reload --port 8000
