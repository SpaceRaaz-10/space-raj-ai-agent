from fastapi import FastAPI, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import json
import base64
import io
import webbrowser
import sqlite3
import uuid
import urllib.parse
import re
import os
import requests
from typing import Optional
from groq import Groq
from dotenv import load_dotenv
from pypdf import PdfReader
from duckduckgo_search import DDGS

load_dotenv()
client = Groq()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 🗄️ DATABASE SETUP (SQLite)
# ==========================================
DB_FILE = "chat_history.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            title TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT,
            role TEXT,
            content TEXT,
            image_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chat_id) REFERENCES chats (id)
        )
    ''')
    # Safe migration for image_url
    cursor.execute("PRAGMA table_info(messages)")
    columns = [column[1] for column in cursor.fetchall()]
    if 'image_url' not in columns:
        cursor.execute("ALTER TABLE messages ADD COLUMN image_url TEXT")
        
    conn.commit()
    conn.close()

init_db()

# ==========================================
# 🛠️ LOCAL TOOLS
# ==========================================
SAFE_APPS = {
    "whatsapp": "start whatsapp:", "brave": "start brave", "chrome": "start chrome",
    "browser": "start chrome", "explorer": "explorer.exe", "files": "explorer.exe",
    "settings": "start ms-settings:", "notepad": "notepad.exe", "calculator": "calc.exe"
}

def open_application(app_name):
    app_key = app_name.lower().strip()
    if app_key in SAFE_APPS:
        try:
            subprocess.Popen(SAFE_APPS[app_key], shell=True)
            return f"Successfully opened {app_name}."
        except Exception as e:
            return f"Error opening {app_name}: {e}"
    return f"Security block: I am not allowed to open '{app_name}'."

def lock_computer():
    try:
        subprocess.Popen("rundll32.exe user32.dll,LockWorkStation")
        return "Computer locked."
    except Exception as e:
        return f"Error locking PC: {e}"

def open_url(url):
    try:
        if not url.startswith("http"): url = "https://" + url
        webbrowser.open(url)
        return f"Successfully opened {url} in the browser."
    except Exception as e:
        return f"Error opening URL: {e}"

def search_web(query):
    try:
        results = DDGS().text(query, max_results=3)
        if not results: return "No results found."
        formatted = "\n".join([f"- {r['title']}: {r['body']} ({r['href']})" for r in results])
        return formatted
    except Exception as e:
        return f"Search failed: {e}"

def generate_image(prompt):
    try:
        api_token = os.getenv("CLOUDFLARE_API_TOKEN")
        account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
        
        if api_token and account_id:
            url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/black-forest-labs/flux-1-schnell"
            headers = {"Authorization": f"Bearer {api_token}", "Content-Type": "application/json"}
            payload = {"prompt": prompt, "num_steps": 4}
            response = requests.post(url, headers=headers, json=payload)
            if response.status_code == 200:
                result = response.json()
                image_b64 = result.get("result", {}).get("image")
                if image_b64:
                    return f"data:image/jpeg;base64,{image_b64}"

        # Fallback to Pollinations
        encoded_prompt = urllib.parse.quote(prompt)
        return f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true&enhance=true"
    except Exception as e:
        return f"Error generating image: {e}"

local_functions = {
    "open_application": open_application, 
    "lock_computer": lock_computer,
    "open_url": open_url,
    "search_web": search_web,
    "generate_image": generate_image
}

local_tools = [
    {"type": "function", "function": {"name": "open_application", "description": "Opens an app.", "parameters": {"type": "object", "properties": {"app_name": {"type": "string"}}, "required": ["app_name"]}}},
    {"type": "function", "function": {"name": "lock_computer", "description": "Locks the Windows PC.", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "open_url", "description": "Opens a URL in the browser.", "parameters": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}}},
    {"type": "function", "function": {"name": "search_web", "description": "Searches the live web.", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {"name": "generate_image", "description": "Generates an image based on a text prompt.", "parameters": {"type": "object", "properties": {"prompt": {"type": "string"}}, "required": ["prompt"]}}}
]

# ==========================================
# 🌐 API ENDPOINTS
# ==========================================
@app.get("/chats")
async def get_chats():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT id, title FROM chats ORDER BY created_at DESC")
    chats = [{"id": row[0], "title": row[1]} for row in cursor.fetchall()]
    conn.close()
    return {"chats": chats}

@app.get("/chats/{chat_id}")
async def get_chat_messages(chat_id: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT role, content, image_url FROM messages WHERE chat_id = ? ORDER BY id ASC", (chat_id,))
    messages = [{"role": row[0], "content": row[1], "imageUrl": row[2]} for row in cursor.fetchall()]
    conn.close()
    return {"messages": messages}

@app.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages WHERE chat_id = ?", (chat_id,))
    cursor.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

@app.post("/chat")
async def chat_endpoint(
    message: str = Form(...),
    chat_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()

        # 1. Create new chat if needed
        is_new_chat = False
        if not chat_id or chat_id == "null" or chat_id == "":
            chat_id = str(uuid.uuid4())
            title = message[:30] + "..." if len(message) > 30 else message
            if not title.strip(): title = "New Chat"
            cursor.execute("INSERT INTO chats (id, title) VALUES (?, ?)", (chat_id, title))
            conn.commit()
            is_new_chat = True

        # 2. Process File (BEFORE saving to DB so history is accurate)
        file_content = ""
        image_base64 = None
        image_mime = None

        if file:
            content = await file.read()
            if file.content_type.startswith("image/"):
                image_base64 = base64.b64encode(content).decode('utf-8')
                image_mime = file.content_type
                message = message + "\n\n[User uploaded an image. Analyze it using your vision.]"
            elif file.content_type == "application/pdf":
                pdf = PdfReader(io.BytesIO(content))
                for page in pdf.pages:
                    file_content += page.extract_text() + "\n"
                message += f"\n\n[Attached PDF Content]:\n{file_content[:4000]}"
            else:
                file_content = content.decode("utf-8", errors="ignore")
                message += f"\n\n[Attached File Content]:\n{file_content[:4000]}"

        # 3. Save User Message to DB (Fully processed)
        cursor.execute("INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)", (chat_id, "user", message))
        conn.commit()

        # 4. Fetch COMPLETE History from DB (Includes the message we just saved)
        cursor.execute("SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id ASC", (chat_id,))
        history_from_db = [{"role": row[0], "content": row[1]} for row in cursor.fetchall()]

        # 5. Setup System Prompt
        system_prompt = (
            "You are my absolute ride-or-die best friend. Talk to me like a real homie. "
            "Use heavy casual slang and swear words freely. Roast me if I say something stupid. "
            "You have superpowers: you can control my PC, open URLs, search the web, analyze images/files, and GENERATE IMAGES. "
            "CRITICAL: If I ask you to draw, generate, or make a picture, YOU MUST USE the 'generate_image' tool. "
            "IMPORTANT: After you generate an image, DO NOT output the markdown link or URL in your text response. Just tell me what you made. "
            "MEMORY: You have access to the full history of this chat. You MUST remember what we talked about earlier. If I ask 'what is my name?' or 'what did I just say?', look at the history and answer accurately."
        )
        
        # Combine system prompt + full history
        messages = [{"role": "system", "content": system_prompt}] + history_from_db

        # 6. API Configuration
        if image_base64:
            model_to_use = "meta-llama/llama-4-scout-17b-16e-instruct" 
            # Overwrite the last message (which is the current user message) to include the image
            messages[-1] = {
                "role": "user",
                "content": [
                    {"type": "text", "text": message},
                    {"type": "image_url", "image_url": {"url": f"data:{image_mime};base64,{image_base64}"}}
                ]
            }
            api_args = {"model": model_to_use, "messages": messages, "temperature": 0.7, "max_tokens": 1024}
        else:
            model_to_use = "openai/gpt-oss-120b"
            api_args = {
                "model": model_to_use,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 1024,
                "tools": local_tools,
                "tool_choice": "auto"
            }

        # 7. API Call & Tool Loop
        completion = client.chat.completions.create(**api_args)
        response_message = completion.choices[0].message

        loop_count = 0
        generated_image_url = None
        
        while hasattr(response_message, 'tool_calls') and response_message.tool_calls and loop_count < 3:
            loop_count += 1
            messages.append(response_message)
            
            for tool_call in response_message.tool_calls:
                function_name = tool_call.function.name
                try:
                    function_args = json.loads(tool_call.function.arguments)
                    function_to_call = local_functions[function_name]
                    function_response = function_to_call(**function_args)
                    
                    if function_name == "generate_image":
                        generated_image_url = function_response
                except Exception as e:
                    function_response = f"Error executing tool: {e}"

                messages.append({
                    "tool_call_id": tool_call.id, "role": "tool", "name": function_name, "content": str(function_response),
                })

            second_response = client.chat.completions.create(
                model="openai/gpt-oss-120b", messages=messages, tools=local_tools
            )
            response_message = second_response.choices[0].message

        # 8. Clean up text (remove raw markdown image links)
        raw_text = response_message.content if response_message.content else "Done, bro."
        final_text = re.sub(r'!\[.*?\]\(.*?\)', '', raw_text).strip()
        
        if not final_text:
            final_text = "Here is the image you asked for, bro."

        # 9. Save AI Response to DB
        cursor.execute("INSERT INTO messages (chat_id, role, content, image_url) VALUES (?, ?, ?, ?)", (chat_id, "assistant", final_text, generated_image_url))
        conn.commit()
        conn.close()

        return {"response": final_text, "chat_id": chat_id, "is_new_chat": is_new_chat, "image_url": generated_image_url}

    except Exception as e:
        return {"response": f"❌ System Error: {str(e)}", "chat_id": chat_id if 'chat_id' in locals() else None}