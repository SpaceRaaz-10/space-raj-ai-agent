import { useState, useRef, useEffect } from 'react';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Suggestion chips data
  const suggestions = [
    { text: "Draw a cyberpunk city", icon: "🎨" },
    { text: "Open Chrome", icon: "🌐" },
    { text: "Roast Rajesh Hamal?", icon: "🇳🇵" },
    { text: "Tell me a dark joke", icon: "💀" }
  ];

  useEffect(() => { fetchChats(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  const fetchChats = async () => {
    try {
      const res = await fetch('http://localhost:8000/chats');
      const data = await res.json();
      setChats(data.chats);
    } catch (e) { console.error(e); }
  };

  const loadChat = async (id) => {
    setActiveChatId(id);
    try {
      const res = await fetch(`http://localhost:8000/chats/${id}`);
      const data = await res.json();
      setMessages(data.messages);
    } catch (e) { console.error(e); }
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
  };

  const deleteChat = async (e, id) => {
    e.stopPropagation();
    try {
      await fetch(`http://localhost:8000/chats/${id}`, { method: 'DELETE' });
      setChats(prev => prev.filter(c => c.id !== id));
      if (activeChatId === id) startNewChat();
    } catch (e) { console.error(e); }
  };

  const sendMessage = async (e, overrideInput = null) => {
    if (e) e.preventDefault();
    const messageToSend = overrideInput || input;
    if ((!messageToSend.trim() && !selectedFile) || isLoading) return;

    const userMsg = messageToSend || (selectedFile ? "Analyze this file." : "");
    const fileToSend = selectedFile;
    
    setMessages(prev => [...prev, { role: 'user', content: userMsg, fileName: fileToSend ? fileToSend.name : null }]);
    
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("message", userMsg);
    formData.append("chat_id", activeChatId || "");
    if (fileToSend) formData.append("file", fileToSend);

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response,
        imageUrl: data.image_url
      }]);

      if (data.is_new_chat) {
        setActiveChatId(data.chat_id);
        fetchChats();
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "❌ Connection failed." }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="relative h-screen w-full bg-abstract-mesh text-white overflow-hidden font-['Poppins',sans-serif]">
      
      {/* Background Blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-blue-600/10 rounded-full blur-[120px] blob-1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-purple-600/10 rounded-full blur-[150px] blob-2"></div>
      </div>

      <div className="relative z-10 flex h-full w-full">
        
        {/* ================= SIDEBAR ================= */}
        <div className="w-[260px] border-r border-white/5 bg-black/20 backdrop-blur-3xl flex flex-col justify-between hidden md:flex">
          <div className="p-4 flex flex-col h-full overflow-hidden">
            
            {/* Logo & New Chat Button */}
            <div className="flex justify-between items-center mb-6 px-2 mt-2">
               <div className="flex items-center gap-2 text-lg">
                 <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] font-['Poppins',sans-serif]">S</div>
                 <span className="font-['Syne',sans-serif] font-extrabold tracking-wide">Space</span>
               </div>
               <button onClick={startNewChat} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/20 transition-all cursor-pointer" title="New Chat">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
               </button>
            </div>

            {/* Chat History List */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3 px-3 mt-4">Recent Chats</div>
              {chats.length === 0 && <div className="text-sm text-gray-500 px-3 italic">No chats yet.</div>}
              
              {chats.map(chat => (
                <div 
                  key={chat.id} 
                  onClick={() => loadChat(chat.id)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${activeChatId === chat.id ? 'bg-white/10 text-white border border-white/10' : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'}`}
                >
                  <div className="truncate text-[13px] font-medium pr-2">{chat.title}</div>
                  <button onClick={(e) => deleteChat(e, chat.id)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              ))}
            </div>

            {/* User Profile (Mock) */}
            <div className="pt-4 border-t border-white/5 mt-auto">
              <div className="flex items-center gap-3 px-2 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-all">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 flex items-center justify-center text-sm font-bold text-white">SR</div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Space Raj</span>
                  <span className="text-[11px] text-gray-500">Elon Musk Plan</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ================= MAIN CHAT AREA ================= */}
        <div className="flex-1 flex flex-col relative h-full">
          
          <div className="flex justify-between items-center px-8 py-5 text-sm text-gray-400 border-b border-transparent">
             <div className="flex items-center gap-2.5">
               <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-lg font-['Poppins',sans-serif]">RS</div>
               <span className="font-['Syne',sans-serif] font-bold tracking-wide text-gray-100 text-base">Raj AI Agent</span>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 md:px-12 lg:px-32 flex flex-col items-center">
            {messages.length === 0 ? (
              
              /* EMPTY STATE WITH SUGGESTION CHIPS */
              <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl pb-20">
                <h1 className="text-5xl md:text-7xl font-['Syne',sans-serif] font-extrabold leading-[1.05] tracking-tighter text-center mb-8">
                  What should <br/>
                  we <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">explore?</span>
                </h1>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl px-4 animate-message">
                  {suggestions.map((sug, i) => (
                    <button 
                      key={i}
                      onClick={() => sendMessage(null, sug.text)}
                      className="flex items-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 p-4 rounded-2xl text-left transition-all text-sm text-gray-300 backdrop-blur-md"
                    >
                      <span className="text-xl">{sug.icon}</span>
                      {sug.text}
                    </button>
                  ))}
                </div>
              </div>

            ) : (
              
              /* MESSAGES LIST */
              <div className="w-full max-w-3xl py-8 space-y-6">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-4 animate-message ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    
                    {/* AI Avatar */}
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-lg mt-1 font-['Poppins',sans-serif]">
                        RS
                      </div>
                    )}

                    <div className={`max-w-[80%] px-5 py-3.5 text-[15px] leading-relaxed shadow-sm
                      ${msg.role === 'user' 
                        ? 'bg-[#1a1a1a] border border-white/10 text-white rounded-3xl rounded-tr-sm' 
                        : 'bg-transparent text-gray-200'}`}>
                      
                      {msg.fileName && (
                        <div className="text-[11px] text-blue-400 font-medium mb-2 flex items-center gap-1.5 bg-blue-500/10 w-fit px-2.5 py-1 rounded-md border border-blue-500/20">
                          📎 {msg.fileName}
                        </div>
                      )}
                      
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {msg.imageUrl && (
                        <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                          <img src={msg.imageUrl} alt="Generated" className="w-full h-auto" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-4 justify-start animate-message">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-lg mt-1 font-['Poppins',sans-serif]">RS</div>
                    <div className="px-5 py-3.5 text-gray-500 text-[15px] flex items-center gap-2">
                       <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                       <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-.15s]"></div>
                       <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* INPUT BOX */}
          <div className="p-4 md:px-12 lg:px-32 flex justify-center pb-8">
            <form onSubmit={sendMessage} className="w-full max-w-3xl relative">
              {selectedFile && (
                <div className="absolute -top-12 left-4 bg-blue-600/90 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg border border-blue-400/30 animate-message">
                  📎 {selectedFile.name}
                  <button type="button" onClick={() => setSelectedFile(null)} className="hover:text-red-400 font-bold ml-2 text-sm">×</button>
                </div>
              )}

              {/* Glowing Input Container */}
              <div className="flex items-end bg-[#111111]/90 backdrop-blur-2xl border border-white/10 rounded-[24px] p-2 pl-3 shadow-2xl transition-all duration-300 focus-within:border-blue-500/50 focus-within:shadow-[0_0_25px_rgba(59,130,246,0.2)]">
                
                <input type="file" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files[0])} className="hidden" accept="image/*,.pdf,.txt,.py,.js,.json" />
                
                <button type="button" onClick={() => fileInputRef.current.click()} className="text-gray-400 hover:text-white p-2.5 rounded-full hover:bg-white/10 transition-colors mb-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                </button>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); }
                  }}
                  placeholder="Message Space Raj..."
                  rows="1"
                  className="flex-1 bg-transparent text-white placeholder-gray-500 px-3 py-3 focus:outline-none text-[15px] resize-none max-h-32 min-h-[44px]"
                  style={{ height: 'auto' }}
                />

                <button type="submit" disabled={isLoading || (!input.trim() && !selectedFile)} className={`p-2.5 rounded-full transition-all mb-0.5 mr-0.5 ${(input.trim() || selectedFile) ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-[#222] text-gray-500'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}