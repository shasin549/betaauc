import { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, query, where, updateDoc, arrayUnion } from 'firebase/firestore';
import {
  Home,
  Gavel,
  Hammer,
  Users,
  Plus,
  Send,
  Link,
  Share2,
  Trophy,
  Crown,
  User,
  LogOut,
  X,
  CircleCheck,
} from 'lucide-react';

// Context for Firebase and User state
const AppContext = createContext();

// Global variables provided by the canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const App = () => {
  const [view, setView] = useState('index'); // index, auctioneerSetup, auctioneerRoom, bidderSetup, bidderRoom
  const [room, setRoom] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'auctioneer' or 'bidder'
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [roomCode, setRoomCode] = useState('');

  // Firebase Initialization and Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Authentication failed:", error);
      } finally {
        setIsAuthReady(true);
      }
    };

    onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });

    initAuth();
  }, []);

  const showPopup = (title, message) => {
    setModalTitle(title);
    setModalMessage(message);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalTitle('');
    setModalMessage('');
  };

  if (!isAuthReady || !userId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white font-sans">
        <p>Loading...</p>
      </div>
    );
  }

  const renderView = () => {
    switch (view) {
      case 'index':
        return <IndexPage setView={setView} />;
      case 'auctioneerSetup':
        return <AuctioneerSetup />;
      case 'auctioneerRoom':
        return <AuctioneerRoom />;
      case 'bidderSetup':
        return <BidderSetup />;
      case 'bidderRoom':
        return <BidderRoom />;
      default:
        return <IndexPage setView={setView} />;
    }
  };

  return (
    <AppContext.Provider value={{ db, userId, userRole, setUserRole, room, setRoom, showPopup, setView, roomCode, setRoomCode }}>
      <div className="font-sans bg-gray-950 text-gray-100 min-h-screen">
        {renderView()}
        {showModal && <Modal title={modalTitle} message={modalMessage} onClose={closeModal} />}
      </div>
    </AppContext.Provider>
  );
};

const Modal = ({ title, message, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 text-white p-6 rounded-lg shadow-xl max-w-sm w-full border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-indigo-400">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        <p className="text-sm text-gray-300">{message}</p>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-lg transition-all duration-200 transform hover:scale-105"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

const IndexPage = ({ setView }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div className="max-w-2xl w-full">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">eFootball Card Auction</h1>
        <p className="text-lg md:text-xl text-gray-300 mb-8">Choose your role to get started.</p>
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-8">
          <button
            onClick={() => setView('auctioneerSetup')}
            className="flex-1 p-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-2xl transition-all duration-300 transform hover:scale-105 flex flex-col items-center justify-center"
          >
            <Gavel size={48} className="mb-2" />
            <span className="text-2xl">I'm an Auctioneer</span>
          </button>
          <button
            onClick={() => setView('bidderSetup')}
            className="flex-1 p-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-lg shadow-2xl transition-all duration-300 transform hover:scale-105 flex flex-col items-center justify-center"
          >
            <Hammer size={48} className="mb-2" />
            <span className="text-2xl">I'm a Bidder</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const AuctioneerSetup = () => {
  const { db, userId, setView, showPopup, setRoom } = useContext(AppContext);
  const [roomName, setRoomName] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [bidIncrement, setBidIncrement] = useState(100);
  const [loading, setLoading] = useState(false);

  const createRoom = async () => {
    if (!roomName) {
      showPopup('Error', 'Please enter a room name.');
      return;
    }
    setLoading(true);
    try {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
      const newRoom = {
        roomName,
        maxParticipants,
        bidIncrement,
        auctioneerId: userId,
        participants: [],
        players: [],
        currentBiddingPlayerIndex: null,
        finalCallState: 0,
        createdAt: new Date(),
        active: true
      };

      await setDoc(roomDocRef, newRoom);
      showPopup('Success', `Auction room created! Share this code with bidders: ${roomCode}`);
      setLoading(false);
      setRoom({ id: roomCode, ...newRoom });
      setView('auctioneerRoom');
    } catch (error) {
      console.error('Error creating room:', error);
      showPopup('Error', 'Failed to create room. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-xl w-full border border-gray-700">
        <h2 className="text-3xl font-bold text-indigo-400 mb-6">Create Auction Room</h2>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Auction Room Name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <label className="block text-gray-300">
            Number of Participants:
            <input
              type="number"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
              className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
            />
          </label>
          <label className="block text-gray-300">
            Bid Increment:
            <input
              type="number"
              value={bidIncrement}
              onChange={(e) => setBidIncrement(parseInt(e.target.value))}
              className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
            />
          </label>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <button
            onClick={createRoom}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
          <button
            onClick={() => setView('index')}
            className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold rounded-md shadow-lg transition-all duration-200 transform hover:scale-105"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const AuctioneerRoom = () => {
  const { room, setRoom, userId, db, showPopup, setView } = useContext(AppContext);
  const [loading, setLoading] = useState(true);
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', club: '', position: '', style: '', value: 0 });
  const [finalCallMessage, setFinalCallMessage] = useState('');
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [selectedParticipantBids, setSelectedParticipantBids] = useState(null);

  useEffect(() => {
    if (!db || !userId) return;

    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'rooms'),
      where('auctioneerId', '==', userId),
      where('active', '==', true)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (querySnapshot.empty) {
        setRoom(null);
        setLoading(false);
        showPopup('Error', 'No active auction room found. Please create one.');
        setView('auctioneerSetup');
        return;
      }
      const doc = querySnapshot.docs[0];
      const roomData = { id: doc.id, ...doc.data() };
      setRoom(roomData);
      setLoading(false);

      const currentPlayerIndex = roomData.currentBiddingPlayerIndex;
      if (currentPlayerIndex !== null && roomData.players[currentPlayerIndex]) {
        const player = roomData.players[currentPlayerIndex];
        switch (roomData.finalCallState) {
          case 1:
            setFinalCallMessage("First call");
            break;
          case 2:
            setFinalCallMessage("Second call");
            break;
          case 3:
            setFinalCallMessage("Final call");
            break;
          default:
            setFinalCallMessage("");
            break;
        }
      } else {
        setFinalCallMessage("");
      }
    }, (error) => {
      console.error("Error fetching room data:", error);
      showPopup('Error', 'Failed to load auction room data.');
      setView('index');
    });

    return () => unsubscribe();
  }, [db, userId, setRoom, showPopup, setView]);

  const handleInputChange = (e) => {
    setNewPlayer({ ...newPlayer, [e.target.name]: e.target.value });
  };

  const addPlayer = async () => {
    if (!newPlayer.name || !newPlayer.club || !newPlayer.position || !newPlayer.style || !newPlayer.value) {
      showPopup('Error', 'Please fill in all player details.');
      return;
    }

    try {
      const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id);
      const updatedPlayers = [...room.players, {
        ...newPlayer,
        value: parseInt(newPlayer.value),
        currentBid: parseInt(newPlayer.value),
        highestBidderId: null,
        highestBidderName: null,
        status: 'pending',
        winnerId: null,
      }];
      await updateDoc(roomDocRef, {
        players: updatedPlayers
      });
      setNewPlayer({ name: '', club: '', position: '', style: '', value: 0 });
      setShowPlayerForm(false);
    } catch (error) {
      console.error('Error adding player:', error);
      showPopup('Error', 'Failed to add player.');
    }
  };

  const startBidding = async () => {
    if (room.players.length === 0) {
      showPopup('Error', 'Please add a player first.');
      return;
    }
    const nextPlayerIndex = room.players.findIndex(p => p.status === 'pending');
    if (nextPlayerIndex === -1) {
      showPopup('Info', 'All players have been auctioned!');
      return;
    }
    try {
      const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id);
      const updatedPlayers = room.players.map((p, index) =>
        index === nextPlayerIndex ? { ...p, status: 'bidding' } : p
      );
      await updateDoc(roomDocRef, {
        currentBiddingPlayerIndex: nextPlayerIndex,
        players: updatedPlayers,
        finalCallState: 0,
      });
    } catch (error) {
      console.error('Error starting bidding:', error);
      showPopup('Error', 'Failed to start bidding.');
    }
  };

  const finalCall = async () => {
    const currentPlayerIndex = room.currentBiddingPlayerIndex;
    if (currentPlayerIndex === null || room.players[currentPlayerIndex].status !== 'bidding') {
      showPopup('Error', 'No active player for bidding.');
      return;
    }

    let newCallState = room.finalCallState + 1;
    const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id);
    
    await updateDoc(roomDocRef, { finalCallState: newCallState });

    if (newCallState === 3) {
      const player = room.players[currentPlayerIndex];
      const updatedPlayers = room.players.map((p, index) =>
        index === currentPlayerIndex ? { ...p, status: 'sold', winnerId: player.highestBidderId } : p
      );
      await updateDoc(roomDocRef, {
        players: updatedPlayers,
        currentBiddingPlayerIndex: null,
      });
      const winnerName = room.participants.find(p => p.id === player.highestBidderId)?.name || 'Anonymous';
      showPopup('Sold!', `${player.name} sold to ${winnerName} for ${player.currentBid}!`);
    }
  };

  const getParticipantsWinningBids = (participantId) => {
    return room.players.filter(player => player.winnerId === participantId);
  };
  
  const showParticipantBids = (participant) => {
    const winningBids = getParticipantsWinningBids(participant.id);
    setSelectedParticipantBids({ ...participant, winningBids });
    setShowParticipantsModal(true);
  };

  const handleShare = async () => {
    const shareText = `Join my eFootball card auction! Room Code: ${room.id}\n\nTo join, enter this code in the app.`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'eFootball Auction',
          text: shareText,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      showPopup('Share', `Copy this text and send it to your friends:\n\n${shareText}`);
      const tempInput = document.createElement('textarea');
      tempInput.value = shareText;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
    }
  };

  if (loading || !room) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white font-sans">
        <p>Loading your room...</p>
      </div>
    );
  }

  const currentPlayer = room.currentBiddingPlayerIndex !== null ? room.players[room.currentBiddingPlayerIndex] : null;

  return (
    <div className="flex flex-col min-h-screen p-4 bg-gray-950 text-gray-100">
      <header className="flex justify-between items-center bg-gray-800 p-4 rounded-b-lg shadow-md mb-4 sticky top-0 z-10">
        <h1 className="text-xl md:text-2xl font-bold text-indigo-400">Room: {room.roomName}</h1>
        <div className="flex items-center space-x-2">
          <button onClick={() => setView('index')} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>
      <main className="flex-1 flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        <div className="w-full md:w-2/3 bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Gavel className="mr-2 text-indigo-400" /> Auctioneer Controls
            </h2>
            <div className="flex flex-wrap gap-2 justify-center md:justify-end">
              <button onClick={handleShare} className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors">
                <Share2 size={16} className="mr-2" />
                Share Room Code
              </button>
            </div>
          </div>
          <div className="mb-6">
            {currentPlayer && currentPlayer.status === 'bidding' ? (
              <div className="bg-gray-700 p-6 rounded-lg border border-gray-600 shadow-inner">
                <h3 className="text-xl font-bold text-white mb-2">Current Player: {currentPlayer.name}</h3>
                <p className="text-gray-300">Club: {currentPlayer.club}</p>
                <p className="text-gray-300">Position: {currentPlayer.position}</p>
                <p className="text-gray-300">Playing Style: {currentPlayer.style}</p>
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-400 mb-1">Current Bid:</p>
                  <p className="text-4xl font-extrabold text-green-400">{currentPlayer.currentBid}</p>
                  <p className="text-sm text-gray-400">
                    Highest Bidder: {currentPlayer.highestBidderName || 'No bids yet'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-700 p-6 rounded-lg border border-gray-600 shadow-inner text-center text-gray-400">
                <p className="text-lg">No player is currently up for auction.</p>
                <p className="text-sm mt-2">Add a player below and click "Start Bidding".</p>
              </div>
            )}
          </div>
          {finalCallMessage && (
            <div className="text-center bg-yellow-900 text-yellow-300 p-3 rounded-md mb-4 font-semibold">
              {finalCallMessage}
            </div>
          )}
          <div className="flex flex-wrap gap-4 justify-center md:justify-start mb-6">
            <button
              onClick={startBidding}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
              disabled={room.players.every(p => p.status !== 'pending')}
            >
              Start Bidding
            </button>
            <button
              onClick={finalCall}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
              disabled={!currentPlayer || currentPlayer.status !== 'biddin
