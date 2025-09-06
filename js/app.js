// Main Application Logic
class VideoConferenceApp {
    constructor() {
        this.socket = null;
        this.localStream = null;
        this.localVideo = null;
        this.peerConnections = new Map();
        this.currentRoom = null;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.currentView = 'gallery'; // 'gallery' or 'speaker'
        this.isMuted = false;
        this.isVideoOff = false;
        this.isScreenSharing = false;
        this.currentBackgroundColor = 'none';
        
        // WebRTC configuration
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.init();
    }

    init() {
        this.setupSocket();
        this.setupEventListeners();
    }

    setupSocket() {
        if (!window.auth || !window.auth.isAuthenticated()) {
            return;
        }

        this.socket = io('https://api.finalexpensedirect.org', {
            auth: {
                token: window.auth.token
            }
        });

        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showNotification(error.message, 'error');
        });

        this.socket.on('user-joined', (data) => {
            this.handleUserJoined(data);
        });

        this.socket.on('user-left', (data) => {
            this.handleUserLeft(data);
        });

        this.socket.on('room-users', (users) => {
            this.handleRoomUsers(users);
        });

        this.socket.on('webrtc-offer', (data) => {
            this.handleWebRTCOffer(data);
        });

        this.socket.on('webrtc-answer', (data) => {
            this.handleWebRTCAnswer(data);
        });

        this.socket.on('webrtc-ice-candidate', (data) => {
            this.handleWebRTCIceCandidate(data);
        });

        this.socket.on('user-muted', (data) => {
            this.handleUserMuted(data);
        });

        this.socket.on('user-video-toggled', (data) => {
            this.handleUserVideoToggled(data);
        });

        this.socket.on('chat-message', (data) => {
            this.handleChatMessage(data);
        });

        this.socket.on('recording-started', (data) => {
            this.handleRecordingStarted(data);
        });

        this.socket.on('recording-stopped', (data) => {
            this.handleRecordingStopped(data);
        });

        window.socket = this.socket;
    }

    setupEventListeners() {
        // Tab switching for Host and Admin
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                this.handleTabSwitch(e.target);
            }
        });

        // Modal handling
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close') || e.target.classList.contains('cancel-btn')) {
                this.closeModal();
            }
        });

        // View controls
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-btn')) {
                this.handleViewSwitch(e.target);
            }
        });
    }

    handleTabSwitch(tabBtn) {
        const parent = tabBtn.closest('.screen');
        if (!parent) return;

        // Remove active class from all tabs and content
        parent.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        parent.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Add active class to clicked tab
        tabBtn.classList.add('active');

        // Show corresponding content
        const tabId = tabBtn.id.replace('-tab', '');
        const content = document.getElementById(tabId);
        if (content) {
            content.classList.add('active');
        }
    }

    handleViewSwitch(viewBtn) {
        const parent = viewBtn.closest('.view-controls');
        if (!parent) return;

        parent.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        viewBtn.classList.add('active');

        this.currentView = viewBtn.id.includes('gallery') ? 'gallery' : 'speaker';
        this.updateVideoLayout();
    }

    async getUserMedia(constraints = { video: true, audio: true }) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            return stream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    }

    async initializeLocalVideo(videoElementId) {
        try {
            this.localStream = await this.getUserMedia();
            this.localVideo = document.getElementById(videoElementId);
            
            if (this.localVideo) {
                this.localVideo.srcObject = this.localStream;
                this.localVideo.play();
            }

            return this.localStream;
        } catch (error) {
            console.error('Failed to initialize local video:', error);
            this.showNotification('Failed to access camera/microphone', 'error');
            throw error;
        }
    }

    async joinRoom(roomId) {
        if (!this.socket || !window.auth.isAuthenticated()) {
            this.showNotification('Not connected to server', 'error');
            return;
        }

        try {
            this.currentRoom = roomId;
            
            this.socket.emit('join-room', {
                roomId: roomId,
                userId: window.auth.user.id,
                username: window.auth.user.username
            });

            this.showNotification('Joining room...', 'info');
        } catch (error) {
            console.error('Failed to join room:', error);
            this.showNotification('Failed to join room', 'error');
        }
    }

    leaveRoom() {
        if (this.currentRoom) {
            // Close all peer connections
            this.peerConnections.forEach((pc, socketId) => {
                pc.close();
            });
            this.peerConnections.clear();

            // Stop local stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }

            // Clear video elements
            this.clearRemoteVideos();

            this.currentRoom = null;
            this.showNotification('Left room', 'info');
        }
    }

    async handleUserJoined(data) {
        console.log('User joined:', data);
        
        try {
            const peerConnection = await this.createPeerConnection(data.socketId);
            
            // Add local stream to peer connection
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, this.localStream);
                });
            }

            // Create and send offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            this.socket.emit('webrtc-offer', {
                target: data.socketId,
                offer: offer
            });

            this.addRemoteVideoElement(data);
        } catch (error) {
            console.error('Error handling user joined:', error);
        }
    }

    handleUserLeft(data) {
        console.log('User left:', data);
        
        const peerConnection = this.peerConnections.get(data.socketId);
        if (peerConnection) {
            peerConnection.close();
            this.peerConnections.delete(data.socketId);
        }

        this.removeRemoteVideoElement(data.socketId);
    }

    handleRoomUsers(users) {
        console.log('Room users:', users);
        
        users.forEach(user => {
            if (user.socketId !== this.socket.id) {
                this.addRemoteVideoElement(user);
            }
        });
    }

    async handleWebRTCOffer(data) {
        try {
            const peerConnection = await this.createPeerConnection(data.sender);
            
            await peerConnection.setRemoteDescription(data.offer);
            
            // Add local stream to peer connection
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, this.localStream);
                });
            }

            // Create and send answer
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            this.socket.emit('webrtc-answer', {
                target: data.sender,
                answer: answer
            });
        } catch (error) {
            console.error('Error handling WebRTC offer:', error);
        }
    }

    async handleWebRTCAnswer(data) {
        try {
            const peerConnection = this.peerConnections.get(data.sender);
            if (peerConnection) {
                await peerConnection.setRemoteDescription(data.answer);
            }
        } catch (error) {
            console.error('Error handling WebRTC answer:', error);
        }
    }

    async handleWebRTCIceCandidate(data) {
        try {
            const peerConnection = this.peerConnections.get(data.sender);
            if (peerConnection) {
                await peerConnection.addIceCandidate(data.candidate);
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    async createPeerConnection(socketId) {
        const peerConnection = new RTCPeerConnection(this.rtcConfig);
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('webrtc-ice-candidate', {
                    target: socketId,
                    candidate: event.candidate
                });
            }
        };

        peerConnection.ontrack = (event) => {
            const remoteVideo = document.getElementById(`remote-video-${socketId}`);
            if (remoteVideo && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                remoteVideo.play();
            }
        };

        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);
        };

        this.peerConnections.set(socketId, peerConnection);
        return peerConnection;
    }

    addRemoteVideoElement(user) {
        const remoteVideosContainer = this.getRemoteVideosContainer();
        if (!remoteVideosContainer) return;

        // Check if video element already exists
        if (document.getElementById(`remote-video-${user.socketId}`)) {
            return;
        }

        const videoContainer = document.createElement('div');
        videoContainer.className = 'remote-video-container';
        videoContainer.id = `remote-container-${user.socketId}`;

        const video = document.createElement('video');
        video.id = `remote-video-${user.socketId}`;
        video.autoplay = true;
        video.playsInline = true;

        const username = document.createElement('div');
        username.className = 'video-username';
        username.textContent = user.username;

        // Add host controls overlay if current user is host/admin
        if (window.auth.hasRole(['Host', 'Admin'])) {
            const overlay = document.createElement('div');
            overlay.className = 'video-overlay';
            
            const controls = document.createElement('div');
            controls.className = 'video-overlay-controls';
            
            const muteBtn = document.createElement('button');
            muteBtn.className = 'control-btn';
            muteBtn.innerHTML = '<span>🔇</span>';
            muteBtn.title = 'Mute User';
            muteBtn.onclick = () => this.muteUser(user.userId);
            
            const kickBtn = document.createElement('button');
            kickBtn.className = 'control-btn';
            kickBtn.innerHTML = '<span>👢</span>';
            kickBtn.title = 'Kick User';
            kickBtn.onclick = () => this.kickUser(user.userId);
            
            const blockBtn = document.createElement('button');
            blockBtn.className = 'control-btn';
            blockBtn.innerHTML = '<span>🚫</span>';
            blockBtn.title = 'Block User';
            blockBtn.onclick = () => this.blockUser(user.userId);
            
            controls.appendChild(muteBtn);
            controls.appendChild(kickBtn);
            controls.appendChild(blockBtn);
            overlay.appendChild(controls);
            videoContainer.appendChild(overlay);
        }

        videoContainer.appendChild(video);
        videoContainer.appendChild(username);
        remoteVideosContainer.appendChild(videoContainer);

        this.updateVideoLayout();
    }

    removeRemoteVideoElement(socketId) {
        const videoContainer = document.getElementById(`remote-container-${socketId}`);
        if (videoContainer) {
            videoContainer.remove();
        }
        this.updateVideoLayout();
    }

    getRemoteVideosContainer() {
        // Try to find the active remote videos container based on current screen
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen) {
            return activeScreen.querySelector('.remote-videos-grid');
        }
        return null;
    }

    clearRemoteVideos() {
        const container = this.getRemoteVideosContainer();
        if (container) {
            container.innerHTML = '';
        }
    }

    updateVideoLayout() {
        const container = this.getRemoteVideosContainer();
        if (!container) return;

        const videos = container.querySelectorAll('.remote-video-container');
        
        if (this.currentView === 'gallery') {
            // Gallery view - show all videos in grid
            container.style.display = 'grid';
            videos.forEach(video => {
                video.style.display = 'block';
            });
        } else {
            // Speaker view - show one main video
            container.style.display = 'flex';
            videos.forEach((video, index) => {
                video.style.display = index === 0 ? 'block' : 'none';
            });
        }
    }

    toggleMute() {
        if (!this.localStream) return;

        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            this.isMuted = !audioTrack.enabled;
            
            this.socket.emit('toggle-mute', { isMuted: this.isMuted });
            
            // Update UI
            this.updateMuteButton();
        }
    }

    toggleVideo() {
        if (!this.localStream) return;

        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            this.isVideoOff = !videoTrack.enabled;
            
            this.socket.emit('toggle-video', { isVideoOff: this.isVideoOff });
            
            // Update UI
            this.updateVideoButton();
        }
    }

    async shareScreen() {
        try {
            if (this.isScreenSharing) {
                // Stop screen sharing
                this.localStream = await this.getUserMedia();
                this.localVideo.srcObject = this.localStream;
                this.isScreenSharing = false;
            } else {
                // Start screen sharing
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
                
                this.localStream = screenStream;
                this.localVideo.srcObject = screenStream;
                this.isScreenSharing = true;
                
                // Handle when user stops sharing via browser UI
                screenStream.getVideoTracks()[0].onended = async () => {
                    this.localStream = await this.getUserMedia();
                    this.localVideo.srcObject = this.localStream;
                    this.isScreenSharing = false;
                    this.updateShareButton();
                };
            }
            
            // Update all peer connections with new stream
            this.peerConnections.forEach(async (pc) => {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(this.localStream.getVideoTracks()[0]);
                }
            });
            
            this.updateShareButton();
        } catch (error) {
            console.error('Error sharing screen:', error);
            this.showNotification('Failed to share screen', 'error');
        }
    }

    updateMuteButton() {
        const muteButtons = document.querySelectorAll('[id*="toggle-mic"]');
        muteButtons.forEach(btn => {
            const icon = btn.querySelector('.mic-icon');
            if (icon) {
                icon.textContent = this.isMuted ? '🔇' : '🎤';
            }
            btn.classList.toggle('muted', this.isMuted);
        });
    }

    updateVideoButton() {
        const videoButtons = document.querySelectorAll('[id*="toggle-video"]');
        videoButtons.forEach(btn => {
            const icon = btn.querySelector('.video-icon');
            if (icon) {
                icon.textContent = this.isVideoOff ? '📹❌' : '📹';
            }
            btn.classList.toggle('muted', this.isVideoOff);
        });
    }

    updateShareButton() {
        const shareButtons = document.querySelectorAll('[id*="share-screen"]');
        shareButtons.forEach(btn => {
            const icon = btn.querySelector('.share-icon');
            if (icon) {
                icon.textContent = this.isScreenSharing ? '📺🔄' : '📺';
            }
            btn.classList.toggle('active', this.isScreenSharing);
        });
    }

    toggleFullscreen() {
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) return;

        if (!document.fullscreenElement) {
            videoContainer.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    sendChatMessage(message) {
        if (!this.socket || !this.currentRoom || !message.trim()) return;

        this.socket.emit('chat-message', { message: message.trim() });
        
        // Add message to local chat
        this.addChatMessage(window.auth.user.username, message, new Date().toISOString());
    }

    handleChatMessage(data) {
        this.addChatMessage(data.username, data.message, data.timestamp);
    }

    addChatMessage(username, message, timestamp) {
        const chatContainer = this.getChatContainer();
        if (!chatContainer) return;

        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        
        const time = new Date(timestamp).toLocaleTimeString();
        
        messageElement.innerHTML = `
            <div class="chat-message-header">${username}</div>
            <div class="chat-message-content">${this.escapeHtml(message)}</div>
            <div class="chat-message-time">${time}</div>
        `;
        
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    getChatContainer() {
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen) {
            return activeScreen.querySelector('.chat-messages');
        }
        return null;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    handleUserMuted(data) {
        // Update UI to show user is muted
        const userVideo = document.getElementById(`remote-container-${data.userId}`);
        if (userVideo) {
            userVideo.classList.toggle('muted', data.isMuted);
        }
    }

    handleUserVideoToggled(data) {
        // Update UI to show user video is off
        const userVideo = document.getElementById(`remote-container-${data.userId}`);
        if (userVideo) {
            userVideo.classList.toggle('video-off', data.isVideoOff);
        }
    }

    handleRecordingStarted(data) {
        this.isRecording = true;
        this.showNotification('Recording started', 'info');
        this.updateRecordingUI();
    }

    handleRecordingStopped(data) {
        this.isRecording = false;
        this.showNotification('Recording stopped', 'info');
        this.updateRecordingUI();
    }

    updateRecordingUI() {
        const recordButtons = document.querySelectorAll('[id*="start-recording"]');
        recordButtons.forEach(btn => {
            btn.textContent = this.isRecording ? 'Stop Recording' : 'Start Recording';
            btn.classList.toggle('active', this.isRecording);
        });
    }

    // Host/Admin actions
    muteUser(userId) {
        if (!window.auth.hasRole(['Host', 'Admin'])) return;
        
        // Implement mute user functionality
        console.log('Muting user:', userId);
        this.showNotification('User muted', 'info');
    }

    kickUser(userId) {
        if (!window.auth.hasRole(['Host', 'Admin'])) return;
        
        // Implement kick user functionality
        console.log('Kicking user:', userId);
        this.showNotification('User kicked from room', 'info');
    }

    blockUser(userId) {
        if (!window.auth.hasRole(['Host', 'Admin'])) return;
        
        // Implement block user functionality
        console.log('Blocking user:', userId);
        this.showNotification('User blocked from room', 'info');
    }

    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#dc3545' : type === 'info' ? '#17a2b8' : '#28a745'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            animation: slideInRight 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    applyBackgroundFilter(color) {
        if (!this.localVideo) return;

        this.currentBackgroundColor = color;
        
        if (color === 'none') {
            this.localVideo.style.filter = '';
        } else {
            // This is a simple implementation - in production you'd want proper background replacement
            this.localVideo.style.filter = `hue-rotate(${this.getHueRotation(color)}deg)`;
        }
    }

    getHueRotation(color) {
        const colorMap = {
            '#F8F7FF': 0,
            '#00A6FB': 200,
            '#006494': 210,
            '#003554': 220,
            '#051923': 240
        };
        return colorMap[color] || 0;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.videoApp = new VideoConferenceApp();
});