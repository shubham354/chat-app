import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';
import { Send, Phone, Video, FileText, Clock, UserPlus, ThumbsUp, ThumbsDown, Smile } from 'lucide-react';
import { encrypt, decrypt, generateKeyPair } from '../utils/encryption';
import { motion } from 'framer-motion';

const Chat: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<{ sender: string; content: string; timestamp: number; reactions: { [key: string]: string[] } }[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expirationTime, setExpirationTime] = useState(0);
  const [currentGroup, setCurrentGroup] = useState<string | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [keyPair, setKeyPair] = useState<{ publicKey: string; secretKey: string } | null>(null);

  useEffect(() => {
    const newKeyPair = generateKeyPair();
    setKeyPair(newKeyPair);

    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('message', (encryptedMessage) => {
      if (keyPair) {
        const decryptedMessage = decrypt(encryptedMessage.content, encryptedMessage.senderPublicKey, keyPair.secretKey);
        setMessages((prevMessages) => [...prevMessages, { ...encryptedMessage, content: decryptedMessage }]);
      }
    });

    newSocket.on('call', ({ signal }) => {
      const newPeer = new SimplePeer({ trickle: false, stream: videoRef.current?.srcObject as MediaStream });
      newPeer.signal(signal);
      newPeer.on('stream', (stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
      setPeer(newPeer);
      setIsCallActive(true);
    });

    newSocket.on('groupCreated', (groupName) => {
      setGroups((prevGroups) => [...prevGroups, groupName]);
    });

    newSocket.on('reaction', ({ messageId, reaction, user }) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                reactions: {
                  ...msg.reactions,
                  [reaction]: [...(msg.reactions[reaction] || []), user],
                },
              }
            : msg
        )
      );
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const sendMessage = () => {
    if (inputMessage.trim() && socket && keyPair) {
      const encryptedContent = encrypt(inputMessage, 'recipientPublicKey', keyPair.secretKey);
      const message = {
        sender: user?.username,
        content: encryptedContent,
        timestamp: Date.now(),
        expirationTime: expirationTime > 0 ? Date.now() + expirationTime * 1000 : 0,
        group: currentGroup,
        senderPublicKey: keyPair.publicKey,
      };
      socket.emit('message', message);
      setMessages((prevMessages) => [...prevMessages, { ...message, content: inputMessage, reactions: {} }]);
      setInputMessage('');
      setExpirationTime(0);
    }
  };

  const startCall = async (video: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      const newPeer = new SimplePeer({ initiator: true, trickle: false, stream });
      newPeer.on('signal', (data) => {
        socket?.emit('call', { to: 'recipient_id', signal: data });
      });
      newPeer.on('stream', (remoteStream) => {
        if (videoRef.current) videoRef.current.srcObject = remoteStream;
      });
      setPeer(newPeer);
      setIsCallActive(true);
    } catch (error) {
      console.error('Error starting call:', error);
    }
  };

  const endCall = () => {
    if (peer) {
      peer.destroy();
      setPeer(null);
    }
    setIsCallActive(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const sendFile = () => {
    if (selectedFile && socket && keyPair) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const encryptedFile = encrypt(e.target?.result as string, 'recipientPublicKey', keyPair.secretKey);
        socket.emit('file', { name: selectedFile.name, data: encryptedFile, senderPublicKey: keyPair.publicKey });
      };
      reader.readAsDataURL(selectedFile);
      setSelectedFile(null);
    }
  };

  const createGroup = () => {
    const groupName = prompt('Enter group name:');
    if (groupName && socket) {
      socket.emit('createGroup', groupName);
    }
  };

  const joinGroup = (groupName: string) => {
    setCurrentGroup(groupName);
    // Fetch group messages from the server
    socket?.emit('joinGroup', groupName);
  };

  const addReaction = (messageId: string, reaction: string) => {
    socket?.emit('reaction', { messageId, reaction, user: user?.username });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`mb-4 ${msg.sender === user?.username ? 'text-right' : 'text-left'}`}
          >
            <div className={`inline-block p-2 rounded-lg ${msg.sender === user?.username ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>
              <p className="font-bold">{msg.sender}</p>
              <p>{msg.content}</p>
              <p className="text-xs text-gray-500">{new Date(msg.timestamp).toLocaleTimeString()}</p>
              <div className="flex mt-1">
                {['👍', '👎', '😄', '😢', '❤️'].map((reaction) => (
                  <button
                    key={reaction}
                    onClick={() => addReaction(msg.id, reaction)}
                    className="mr-1 text-xs bg-gray-200 rounded px-1"
                  >
                    {reaction} {msg.reactions[reaction]?.length || 0}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="bg-white p-4">
        <div className="flex items-center mb-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className="flex-1 border rounded-l-lg p-2"
            placeholder="Type a message..."
          />
          <button onClick={sendMessage} className="bg-blue-500 text-white p-2 rounded-r-lg">
            <Send size={20} />
          </button>
        </div>
        <div className="flex justify-between">
          <div>
            <button onClick={() => startCall(false)} className="mr-2 bg-green-500 text-white p-2 rounded-lg">
              <Phone size={20} />
            </button>
            <button onClick={() => startCall(true)} className="mr-2 bg-purple-500 text-white p-2 rounded-lg">
              <Video size={20} />
            </button>
            <input type="file" onChange={handleFileChange} className="hidden" id="fileInput" />
            <label htmlFor="fileInput" className="mr-2 bg-yellow-500 text-white p-2 rounded-lg cursor-pointer">
              <FileText size={20} />
            </label>
            {selectedFile && (
              <button onClick={sendFile} className="bg-orange-500 text-white p-2 rounded-lg">
                Send File
              </button>
            )}
            <button onClick={createGroup} className="ml-2 bg-indigo-500 text-white p-2 rounded-lg">
              <UserPlus size={20} />
            </button>
          </div>
          <div className="flex items-center">
            <Clock size={20} className="mr-2" />
            <input
              type="number"
              value={expirationTime}
              onChange={(e) => setExpirationTime(parseInt(e.target.value))}
              className="border rounded p-1 w-16"
              placeholder="Expiration (s)"
            />
          </div>
        </div>
      </div>
      <div className="bg-gray-200 p-2">
        <h3 className="font-bold mb-2">Groups:</h3>
        <div className="flex flex-wrap">
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => joinGroup(group)}
              className={`mr-2 mb-2 p-1 rounded ${currentGroup === group ? 'bg-blue-500 text-white' : 'bg-white'}`}
            >
              {group}
            </button>
          ))}
        </div>
      </div>
      {isCallActive && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg">
            <video ref={videoRef} autoPlay playsInline className="w-full max-w-lg" />
            <button onClick={endCall} className="mt-4 bg-red-500 text-white p-2 rounded-lg">
              End Call
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;