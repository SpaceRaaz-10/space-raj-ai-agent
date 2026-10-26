import os
from groq import Groq
from dotenv import load_dotenv

# Load your API key
load_dotenv()
client = Groq()

# Initialize conversation memory with a system prompt
messages = [
    {"role": "system", "content": "You are a helpful, smart, and friendly AI assistant. Keep your answers clear and conversational."}
]

def chat():
    print("🤖 AI Chat Agent is ready! (Type 'exit' or 'quit' to stop)")
    print("-" * 50)
    
    while True:
        # 1. Get user input
        user_input = input("\nYou: ")
        
        # 2. Check for exit commands
        if user_input.lower() in ["exit", "quit", "stop"]:
            print("\n👋 Goodbye!")
            break
            
        if not user_input.strip():
            continue

        # 3. Add user message to history
        messages.append({"role": "user", "content": user_input})
        
        try:
            # 4. Get response from Groq
            print("🤖 Thinking...", end="\r") # Overwrites itself when response arrives
            completion = client.chat.completions.create(
                model="openai/gpt-oss-120b", # The model we fixed earlier
                messages=messages,
                temperature=0.7,
                max_tokens=500,
            )
            
            # 5. Extract response
            assistant_text = completion.choices[0].message.content
            
            # 6. Print and save to history
            print(f"🤖 AI: {assistant_text}")
            messages.append({"role": "assistant", "content": assistant_text})
            
        except Exception as e:
            print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    chat()