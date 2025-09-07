// Member Interface Module
class MemberApp {
    constructor() {
        this.rooms = [];
        this.currentRoom = null;
        this.isInRoom = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.loadingTimeout = null;
    }

    async init() {
        console.log('Member App initializing...');
        
        if (!window.auth || !window.auth.hasRole('Member')) {
            console.log('User does not have Member role, skipping Member App init');
            return;
        }

        await this.loadRoomsWithRetry();
        this.setupEventListeners();
        console.log('Member App initialized successfully');
    }

    setupEventListeners() {
        console.log('Setting up Member App event listeners...');
        
        // Video controls with better error handling
        const toggleMicBtn = document.getElementById('member-toggle-mic');
        if (toggleMicBtn) {
            toggleMicBtn.addEventListener('click', () => {
                try {
                    if (window.videoApp && window.videoApp.toggleMute) {
                        window.videoApp.toggleMute();
                    } else {
                        this.showError('Video app not available');
                    }
                } catch (error) {
                    console.error('Error toggling mic:', error);
                    this.showError('Failed to toggle microphone');
                }
            });
        }

        const toggleVideoBtn = document.getElementById('member-toggle-video');
        if (toggleVideoBtn) {
            toggleVideoBtn.addEventListener('click', () => {
                try {
                    if (window.videoApp && window.videoApp.toggleVideo) {
                        window.videoApp.toggleVideo();
                    } else {
                        this.showError('Video app not available');
                    }
                } catch (error) {
                    console.error('Error toggling video:', error);
                    this.showError('Failed to toggle camera');
                }
            });
        }

        const shareScreenBtn = document.getElementById('member-share-screen');
        if (shareScreenBtn) {
            shareScreenBtn.addEventListener('click', () => {
                try {
                    if (window.videoApp && window.videoApp.shareScreen) {
                        window.videoApp.shareScreen();
                    } else {
                        this.showError('Screen sharing not available');
                    }
                } catch (error) {
                    console.error('Error sharing screen:', error);
                    this.showError('Failed to share screen');
                }
            });
        }

        const fullscreenBtn = document.getElementById('member-toggle-fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                try {
                    if (window.videoApp && window.videoApp.toggleFullscreen) {
                        window.videoApp.toggleFullscreen();
                    } else {
                        this.showError('Fullscreen not available');
                    }
                } catch (error) {
                    console.error('Error toggling fullscreen:', error);
                    this.showError('Failed to toggle fullscreen');
                }
            });
        }

        const leaveRoomBtn = document.getElementById('member-leave-room');
        if (leaveRoomBtn) {
            leaveRoomBtn.addEventListener('click', () => {
                this.leaveRoom();
            });
        }

        // Chat functionality with better validation
        const chatInput = document.getElementById('member-chat-input');
        const sendChatBtn = document.getElementById('member-send-chat');
        
        if (chatInput && sendChatBtn) {
            const sendMessage = () => {
                const message = chatInput.value.trim();
                if (message && message.length > 0) {
                    try {
                        if (window.videoApp && window.videoApp.sendChatMessage) {
                            window.videoApp.sendChatMessage(message);
                            chatInput.value = '';
                        } else {
                            this.showError('Chat not available');
                        }
                    } catch (error) {
                        console.error('Error sending chat message:', error);
                        this.showError('Failed to send message');
                    }
                }
            };

            sendChatBtn.addEventListener('click', sendMessage);
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        // Background selector with validation
        const backgroundSelector = document.getElementById('member-background-color');
        if (backgroundSelector) {
            backgroundSelector.addEventListener('change', (e) => {
                this.changeBackground(e.target.value);
            });
        }

        // View controls with proper state management
        const galleryViewBtn = document.getElementById('member-gallery-view');
        const speakerViewBtn = document.getElementById('member-speaker-view');
        
        if (galleryViewBtn) {
            galleryViewBtn.addEventListener('click', () => {
                this.switchView('gallery');
            });
        }
        
        if (speakerViewBtn) {
            speakerViewBtn.addEventListener('click', () => {
                this.switchView('speaker');
            });
        }

        console.log('Member App event listeners set up successfully');
    }

    async loadRoomsWithRetry() {
        console.log(`Attempting to load rooms (attempt ${this.retryCount + 1}/${this.maxRetries})...`);
        
        try {
            this.showLoadingState();
            const rooms = await window.auth.apiCall('/api/rooms');
            
            if (Array.isArray(rooms)) {
                this.rooms = rooms;
                this.renderRooms();
                this.retryCount = 0; // Reset retry count on success
                console.log(`Successfully loaded ${rooms.length} rooms`);
            } else {
                throw new Error('Invalid rooms data received');
            }
        } catch (error) {
            console.error('Failed to load rooms:', error);
            
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                const delay = Math.pow(2, this.retryCount) * 1000; // Exponential backoff
                console.log(`Retrying in ${delay}ms...`);
                
                setTimeout(() => {
                    this.loadRoomsWithRetry();
                }, delay);
            } else {
                this.showError('Failed to load rooms after multiple attempts');
                this.renderErrorState();
            }
        } finally {
            this.hideLoadingState();
        }
    }

    showLoadingState() {
        const roomsList = document.getElementById('member-rooms-list');
        if (roomsList) {
            roomsList.innerHTML = '<div class="loading-spinner">Loading rooms...</div>';
        }
    }

    hideLoadingState() {
        // Loading state will be replaced by renderRooms() or renderErrorState()
    }

    renderErrorState() {
        const roomsList = document.getElementById('member-rooms-list');
        if (roomsList) {
            roomsList.innerHTML = `
                <div class="error-state">
                    <p>Failed to load rooms</p>
                    <button onclick="window.memberApp.refreshRooms()" class="retry-btn">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    renderRooms() {
        const roomsList = document.getElementById('member-rooms-list');
        if (!roomsList) {
            console.warn('Room list element not found');
            return;
        }

        roomsList.innerHTML = '';

        if (!Array.isArray(this.rooms) || this.rooms.length === 0) {
            roomsList.innerHTML = '<p class="text-center">No rooms available</p>';
            return;
        }

        this.rooms.forEach(room => {
            try {
                const roomElement = document.createElement('div');
                roomElement.className = 'room-item';
                roomElement.innerHTML = `
                    <div class="room-name">${this.escapeHtml(room.name)}</div>
                    <div class="room-description">${this.escapeHtml(room.description || '')}</div>
                    <div class="room-participants">
                        👥 Max: ${parseInt(room.max_participants) || 0}
                    </div>
                    <button class="join-room-btn" data-room-id="${room.id}">
                        Join Room
                    </button>
                `;

                const joinBtn = roomElement.querySelector('.join-room-btn');
                if (joinBtn) {
                    joinBtn.addEventListener('click', () => {
                        this.joinRoom(room);
                    });
                }

                roomsList.appendChild(roomElement);
            } catch (error) {
                console.error('Error rendering room:', room, error);
            }
        });

        // Update UI state after rendering
        this.updateRoomUI();
    }

    async joinRoom(room) {
        if (!room || !room.id) {
            this.showError('Invalid room data');
            return;
        }

        console.log('Attempting to join room:', room.name);

        if (this.isInRoom) {
            if (!confirm('You are currently in a room. Do you want to leave and join this room?')) {
                return;
            }
            await this.leaveRoom();
        }

        try {
            // Show joining state
            const joinBtn = document.querySelector(`[data-room-id="${room.id}"]`);
            if (joinBtn) {
                joinBtn.textContent = 'Joining...';
                joinBtn.disabled = true;
            }

            // Ensure video app is available
            if (!window.videoApp) {
                throw new Error('Video application not available');
            }

            // Initialize local video with proper error handling
            try {
                if (!window.videoApp.localStream) {
                    console.log('Initializing local video...');
                    await window.videoApp.initializeLocalVideo('member-local-video');
                    console.log('Local video initialized successfully');
                }
            } catch (videoError) {
                console.error('Failed to initialize video:', videoError);
                // Continue with audio-only mode
                this.showInfo('Continuing in audio-only mode');
            }

            // Join the room
            console.log('Joining room via video app...');
            await window.videoApp.joinRoom(room.id);
            
            this.currentRoom = room;
            this.isInRoom = true;
            
            // Update UI
            this.updateRoomUI();
            
            this.showSuccess(`Joined ${room.name}`);
            console.log('Successfully joined room:', room.name);
        } catch (error) {
            console.error('Failed to join room:', error);
            this.showError(`Failed to join room: ${error.message}`);
            
            // Reset button state
            const joinBtn = document.querySelector(`[data-room-id="${room.id}"]`);
            if (joinBtn) {
                joinBtn.textContent = 'Join Room';
                joinBtn.disabled = false;
            }
        }
    }

    async leaveRoom() {
        if (!this.isInRoom) {
            console.log('Not currently in a room');
            return;
        }

        console.log('Leaving room:', this.currentRoom?.name);

        try {
            if (window.videoApp && window.videoApp.leaveRoom) {
                window.videoApp.leaveRoom();
            }
            
            this.currentRoom = null;
            this.isInRoom = false;
            
            // Stop local video
            const localVideo = document.getElementById('member-local-video');
            if (localVideo && localVideo.srcObject) {
                localVideo.srcObject = null;
            }
            
            // Update UI
            this.updateRoomUI();
            
            this.showInfo('Left room');
            console.log('Successfully left room');
        } catch (error) {
            console.error('Error leaving room:', error);
            this.showError('Failed to leave room properly');
        }
    }

    updateRoomUI() {
        // Update room items to show current room
        const roomItems = document.querySelectorAll('#member-rooms-list .room-item');
        roomItems.forEach(item => {
            const joinBtn = item.querySelector('.join-room-btn');
            if (joinBtn && joinBtn.dataset.roomId) {
                const roomId = parseInt(joinBtn.dataset.roomId);
                
                if (this.currentRoom && roomId === this.currentRoom.id) {
                    item.classList.add('active');
                    joinBtn.textContent = 'Current Room';
                    joinBtn.disabled = true;
                } else {
                    item.classList.remove('active');
                    joinBtn.textContent = 'Join Room';
                    joinBtn.disabled = false;
                }
            }
        });

        // Show/hide video container based on room status
        const videoContainer = document.getElementById('member-video-container');
        if (videoContainer) {
            videoContainer.style.display = this.isInRoom ? 'flex' : 'none';
        }

        // Update leave room button
        const leaveBtn = document.getElementById('member-leave-room');
        if (leaveBtn) {
            leaveBtn.style.display = this.isInRoom ? 'block' : 'none';
        }

        // Update video controls availability
        const controlButtons = document.querySelectorAll('.video-controls .control-btn');
        controlButtons.forEach(btn => {
            if (btn.id !== 'member-leave-room') {
                btn.disabled = !this.isInRoom;
                btn.classList.toggle('disabled', !this.isInRoom);
            }
        });
    }

    changeBackground(color) {
        if (!color) {
            console.warn('No background color specified');
            return;
        }

        try {
            if (window.videoApp && window.videoApp.applyBackgroundFilter) {
                window.videoApp.applyBackgroundFilter(color);
                console.log('Applied background color:', color);
            } else {
                this.showError('Background filter not available');
            }
        } catch (error) {
            console.error('Error changing background:', error);
            this.showError('Failed to change background');
        }
    }

    switchView(viewType) {
        if (!viewType || !this.isInRoom) {
            console.warn('Invalid view type or not in room');
            return;
        }

        try {
            const galleryBtn = document.getElementById('member-gallery-view');
            const speakerBtn = document.getElementById('member-speaker-view');
            
            if (galleryBtn && speakerBtn) {
                galleryBtn.classList.toggle('active', viewType === 'gallery');
                speakerBtn.classList.toggle('active', viewType === 'speaker');
            }
            
            if (window.videoApp) {
                window.videoApp.currentView = viewType;
                if (window.videoApp.updateVideoLayout) {
                    window.videoApp.updateVideoLayout();
                }
                console.log('Switched to view:', viewType);
            }
        } catch (error) {
            console.error('Error switching view:', error);
            this.showError('Failed to switch view');
        }
    }

    // Helper methods
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        console.error('Member App Error:', message);
        if (window.videoApp && window.videoApp.showNotification) {
            window.videoApp.showNotification(message, 'error');
        } else {
            alert('Error: ' + message);
        }
    }

    showSuccess(message) {
        console.log('Member App Success:', message);
        if (window.videoApp && window.videoApp.showNotification) {
            window.videoApp.showNotification(message, 'success');
        }
    }

    showInfo(message) {
        console.log('Member App Info:', message);
        if (window.videoApp && window.videoApp.showNotification) {
            window.videoApp.showNotification(message, 'info');
        }
    }

    // Public methods for external access
    getCurrentRoom() {
        return this.currentRoom;
    }

    isUserInRoom() {
        return this.isInRoom;
    }

    async refreshRooms() {
        console.log('Manual refresh requested');
        this.retryCount = 0; // Reset retry count for manual refresh
        return await this.loadRoomsWithRetry();
    }

    // Method to handle connection status changes
    handleConnectionChange(isConnected) {
        if (isConnected) {
            console.log('Connection restored, refreshing rooms...');
            this.refreshRooms();
        } else {
            console.log('Connection lost');
            this.showError('Connection lost. Please check your internet connection.');
        }
    }
}

// Initialize Member App when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Member App...');
    window.memberApp = new MemberApp();
    
    // Initialize after a short delay to ensure other components are ready
    setTimeout(() => {
        if (window.memberApp && typeof window.memberApp.init === 'function') {
            window.memberApp.init().catch(error => {
                console.error('Failed to initialize Member App:', error);
            });
        }
    }, 100);
});