import React, { useState, useEffect, useRef } from "react";
import { Container, Form, Button, Spinner } from "react-bootstrap";
import "./App.css";

const tg = window.Telegram.WebApp || {
  ready: () => {},
  themeParams: {
    bg_color: "#ffffff",
    secondary_bg_color: "#f3f3f3",
    text_color: "#000000",
    hint_color: "#aaaaaa",
    button_color: "#2481cc",
    button_text_color: "#ffffff",
  },
};

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatWindowRef = useRef(null);

  useEffect(() => {
    tg.ready();
    const root = document.documentElement;
    root.style.setProperty(
      "--tg-theme-bg-color",
      tg.themeParams.bg_color || "#ffffff"
    );
    root.style.setProperty(
      "--tg-theme-secondary-bg-color",
      tg.themeParams.secondary_bg_color || "#f3f3f3"
    );
    root.style.setProperty(
      "--tg-theme-text-color",
      tg.themeParams.text_color || "#000000"
    );
    root.style.setProperty(
      "--tg-theme-hint-color",
      tg.themeParams.hint_color || "#aaaaaa"
    );
    root.style.setProperty(
      "--tg-theme-button-color",
      tg.themeParams.button_color || "#2481cc"
    );
    root.style.setProperty(
      "--tg-theme-button-text-color",
      tg.themeParams.button_text_color || "#ffffff"
    );
  }, []);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        const errorPayload = await response.json();
        throw new Error(
          errorPayload.error || `HTTP error! status: ${response.status}`
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const jsonChunks = chunk
          .split("data: ")
          .map((c) => c.trim())
          .filter((c) => c);

        for (const jsonChunk of jsonChunks) {
          if (jsonChunk === "[DONE]") {
            break;
          }
          try {
            const parsed = JSON.parse(jsonChunk);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              assistantMessage.content += content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...assistantMessage };
                return updated;
              });
            }
          } catch (e) {
            console.error("Failed to parse stream chunk:", jsonChunk, e);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch or parse:", error);
      const errorMessage = {
        role: "assistant",
        content: `Error: ${error.message}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container fluid className="app-container p-0">
      <div ref={chatWindowRef} className="chat-window">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h2>Grok-4 Chat</h2>
            <p>
              Ask me anything! I'm a helpful assistant powered by OpenRouter.
            </p>
            <p>
              <small>Telegram Mini App by Gemini</small>
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              {msg.content}
            </div>
          ))
        )}
      </div>

      <Form onSubmit={handleSendMessage} className="input-form">
        <Form.Control
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          className="me-2"
        />
        <Button
          variant="primary"
          type="submit"
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? (
            <Spinner as="span" animation="border" size="sm" />
          ) : (
            "Send"
          )}
        </Button>
      </Form>
    </Container>
  );
}

export default App;
