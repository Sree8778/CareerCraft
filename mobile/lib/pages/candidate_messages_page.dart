import 'package:flutter/material.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:async';

class CandidateMessagesPage extends StatefulWidget {
  const CandidateMessagesPage({super.key});

  @override
  State<CandidateMessagesPage> createState() => _CandidateMessagesPageState();
}

class _CandidateMessagesPageState extends State<CandidateMessagesPage> {
  List<dynamic> _chats = [];
  bool _isLoading = true;
  Timer? _chatsTimer;

  @override
  void initState() {
    super.initState();
    _loadChats();
    _chatsTimer = Timer.periodic(const Duration(seconds: 5), (_) => _loadChats(silent: true));
  }

  Future<void> _loadChats({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoading = true;
      });
    }

    try {
      final fetched = await fetchChats('candidate');
      if (mounted) {
        setState(() {
          _chats = fetched;
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Error loading chats: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _chatsTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDarkMode ? const Color(0xFF0F0C20) : Colors.white,
      appBar: AppBar(
        title: const Text('Message Center', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: isDarkMode ? Colors.white : Colors.black),
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
            : _chats.isEmpty
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.forum_outlined, size: 48, color: Colors.grey),
                          SizedBox(height: 16),
                          Text(
                            'No active chats yet. Once recruiters initialize review on your applications, channels will appear here!',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.grey, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16.0),
                    itemCount: _chats.length,
                    itemBuilder: (context, idx) {
                      final chat = _chats[idx];
                      return GlassCard(
                        margin: const EdgeInsets.only(bottom: 12),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => CandidateChatThreadScreen(chat: chat),
                            ),
                          );
                        },
                        child: ListTile(
                          contentPadding: const EdgeInsets.all(12),
                          leading: CircleAvatar(
                            backgroundColor: Colors.deepPurpleAccent,
                            child: Text(
                              (chat['recruiterName'] ?? 'R').toString().substring(0, 1).toUpperCase(),
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                            ),
                          ),
                          title: Text(
                            chat['recruiterName'] ?? 'Recruiter Name',
                            style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87, fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 4),
                              Text(chat['jobTitle'] ?? '', style: const TextStyle(color: Colors.deepPurpleAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 4),
                              Text(
                                chat['lastMessage'] != null && chat['lastMessage'].toString().isNotEmpty
                                    ? chat['lastMessage']
                                    : 'Channel initialized. Converse here...',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: Colors.grey, fontSize: 12),
                              ),
                            ],
                          ),
                          trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}

class CandidateChatThreadScreen extends StatefulWidget {
  final Map<String, dynamic> chat;

  const CandidateChatThreadScreen({super.key, required this.chat});

  @override
  State<CandidateChatThreadScreen> createState() => _CandidateChatThreadScreenState();
}

class _CandidateChatThreadScreenState extends State<CandidateChatThreadScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  List<dynamic> _messages = [];
  bool _isLoading = true;
  bool _isSending = false;
  Timer? _messagesTimer;

  @override
  void initState() {
    super.initState();
    _loadMessages();
    _messagesTimer = Timer.periodic(const Duration(seconds: 3), (_) => _loadMessages(silent: true));
  }

  Future<void> _loadMessages({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoading = true;
      });
    }

    try {
      final fetched = await fetchChatMessages(widget.chat['id']);
      if (mounted) {
        setState(() {
          _messages = fetched;
          _isLoading = false;
        });
        if (!silent) _scrollToBottom();
      }
    } catch (e) {
      print('Error loading messages: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _isSending) return;

    setState(() {
      _isSending = true;
    });
    _messageController.clear();

    final user = FirebaseAuth.instance.currentUser;
    final senderId = user?.uid ?? 'mock_uid_123';
    final senderName = user?.displayName ?? 'Jane Doe';

    try {
      final msg = await sendChatMessage(widget.chat['id'], text, senderId, senderName);
      if (msg != null && mounted) {
        setState(() {
          _messages.add(msg);
        });
        _scrollToBottom();
      }
    } catch (e) {
      print('Failed to send: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isSending = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _messagesTimer?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final chat = widget.chat;
    final user = FirebaseAuth.instance.currentUser;
    final myUid = user?.uid ?? 'mock_uid_123';

    return Scaffold(
      backgroundColor: isDarkMode ? const Color(0xFF0F0C20) : Colors.white,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(chat['recruiterName'] ?? 'Recruiter Name', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            Text(chat['jobTitle'] ?? '', style: const TextStyle(color: Colors.grey, fontSize: 11)),
          ],
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: isDarkMode ? Colors.white : Colors.black),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
                  : _messages.isEmpty
                      ? const Center(child: Text('Start conversation with recruiter...', style: TextStyle(color: Colors.grey, fontSize: 12)))
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.all(16.0),
                          itemCount: _messages.length,
                          itemBuilder: (context, idx) {
                            final msg = _messages[idx];
                            final isMe = msg['senderId'] == myUid;

                            return Align(
                              alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                              child: Container(
                                constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  color: isMe
                                      ? Colors.deepPurpleAccent
                                      : (isDarkMode ? Colors.white.withOpacity(0.06) : Colors.grey.withOpacity(0.1)),
                                  borderRadius: BorderRadius.only(
                                    topLeft: const Radius.circular(12),
                                    topRight: const Radius.circular(12),
                                    bottomLeft: isMe ? const Radius.circular(12) : Radius.zero,
                                    bottomRight: isMe ? Radius.zero : const Radius.circular(12),
                                  ),
                                  border: Border.all(color: isMe ? Colors.transparent : Colors.white10),
                                ),
                                child: Text(
                                  msg['text'] ?? '',
                                  style: TextStyle(color: isMe ? Colors.white : (isDarkMode ? Colors.white70 : Colors.black87), fontSize: 12, height: 1.4),
                                ),
                              ),
                            );
                          },
                        ),
            ),
            
            // Bottom Message input bar
            Container(
              padding: const EdgeInsets.all(8.0),
              decoration: BoxDecoration(
                color: isDarkMode ? Colors.black.withOpacity(0.3) : Colors.grey.withOpacity(0.05),
                border: Border(top: BorderSide(color: isDarkMode ? Colors.white12 : Colors.grey.withOpacity(0.2))),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87),
                      decoration: InputDecoration(
                        hintText: 'Type your message...',
                        hintStyle: TextStyle(color: isDarkMode ? Colors.white38 : Colors.black38),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                      ),
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.send, color: Colors.deepPurpleAccent),
                    onPressed: _sendMessage,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
