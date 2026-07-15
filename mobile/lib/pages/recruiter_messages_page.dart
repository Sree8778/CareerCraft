import 'package:flutter/material.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:async';

class RecruiterMessagesPage extends StatefulWidget {
  const RecruiterMessagesPage({super.key});

  @override
  State<RecruiterMessagesPage> createState() => _RecruiterMessagesPageState();
}

class _RecruiterMessagesPageState extends State<RecruiterMessagesPage> {
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
      final fetched = await fetchChats('recruiter');
      if (mounted) {
        setState(() {
          _chats = fetched;
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Error loading recruiter chats: $e');
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
        title: const Text('Recruiter Inbox', style: TextStyle(fontWeight: FontWeight.bold)),
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
                          Icon(Icons.mark_chat_unread_outlined, size: 48, color: Colors.grey),
                          SizedBox(height: 16),
                          Text(
                            'No active chats yet. Go to your candidate listings to start an evaluation and initiate a channel!',
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
                              builder: (context) => RecruiterChatThreadScreen(chat: chat),
                            ),
                          );
                        },
                        child: ListTile(
                          contentPadding: const EdgeInsets.all(12),
                          leading: CircleAvatar(
                            backgroundColor: Colors.tealAccent.withOpacity(0.2),
                            child: Text(
                              (chat['candidateName'] ?? 'C').toString().substring(0, 1).toUpperCase(),
                              style: const TextStyle(color: Colors.teal, fontWeight: FontWeight.bold),
                            ),
                          ),
                          title: Text(
                            chat['candidateName'] ?? 'Candidate Name',
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
                                    : 'Channel initialized. Chat with candidate...',
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

class RecruiterChatThreadScreen extends StatefulWidget {
  final Map<String, dynamic> chat;

  const RecruiterChatThreadScreen({super.key, required this.chat});

  @override
  State<RecruiterChatThreadScreen> createState() => _RecruiterChatThreadScreenState();
}

class _RecruiterChatThreadScreenState extends State<RecruiterChatThreadScreen> {
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
    final senderId = user?.uid ?? widget.chat['recruiterId'] ?? 'mock_recruiter_123';
    final senderName = user?.displayName ?? widget.chat['recruiterName'] ?? 'Recruiter';

    try {
      final msg = await sendChatMessage(widget.chat['id'], text, senderId, senderName);
      if (msg != null && mounted) {
        setState(() {
          _messages.add(msg);
        });
        _scrollToBottom();
      }
    } catch (e) {
      print('Failed to send message: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isSending = false;
        });
      }
    }
  }

  Future<void> _sendSystemMessage(String text) async {
    final senderId = 'system';
    final senderName = 'System Notification';
    try {
      final msg = await sendChatMessage(widget.chat['id'], text, senderId, senderName);
      if (msg != null && mounted) {
        setState(() {
          _messages.add(msg);
        });
        _scrollToBottom();
      }
    } catch (e) {
      print('Failed to send system alert message: $e');
    }
  }

  // Quick action: Show candidate details inside a premium bottom sheet
  Future<void> _showCandidatePreview() async {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F0C20),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      isScrollControlled: true,
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.7,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          expand: false,
          builder: (context, scrollController) {
            return SingleChildScrollView(
              controller: scrollController,
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 50,
                      height: 5,
                      decoration: BoxDecoration(
                        color: Colors.white24,
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 30,
                        backgroundColor: Colors.tealAccent.withOpacity(0.2),
                        child: Text(
                          widget.chat['candidateName'].toString().substring(0,1).toUpperCase(),
                          style: const TextStyle(fontSize: 24, color: Colors.teal, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.chat['candidateName'] ?? 'Candidate Profile',
                              style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              widget.chat['jobTitle'] ?? 'Software Professional',
                              style: const TextStyle(color: Colors.deepPurpleAccent, fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Divider(color: Colors.white12),
                  const SizedBox(height: 12),
                  
                  // Interactive profile card sections
                  const Text('PREVIEW STATS', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  
                  GlassCard(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.school, color: Colors.deepPurpleAccent, size: 18),
                              SizedBox(width: 8),
                              Text('Education', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'B.S. Computer Science, Stanford University (2022)',
                            style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13),
                          ),
                          const SizedBox(height: 16),
                          const Row(
                            children: [
                              Icon(Icons.work, color: Colors.deepPurpleAccent, size: 18),
                              SizedBox(width: 8),
                              Text('Experience', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Senior Software Engineer at TechCorp (2023 - Present)',
                            style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13),
                          ),
                          const SizedBox(height: 16),
                          const Row(
                            children: [
                              Icon(Icons.psychology, color: Colors.deepPurpleAccent, size: 18),
                              SizedBox(width: 8),
                              Text('Core Skills', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Flutter, Dart, Firebase, Python, Next.js, Flask, SQLite',
                            style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      // Custom dialog could route directly to candidate full profile
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('To review complete biometrics & anti-cheat audits, visit Candidates Directory.')),
                      );
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.deepPurpleAccent),
                    child: const Text('View Full Assessments & Proctor Logs', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // Quick Action: Schedule Calendar Event
  Future<void> _scheduleMeeting() async {
    final titleController = TextEditingController(text: 'Technical Screening - ${widget.chat['jobTitle']}');
    final descController = TextEditingController(text: 'Live discussion concerning your application for ${widget.chat['jobTitle']}.');
    final dateController = TextEditingController();
    final timeController = TextEditingController();
    final candidateEmailController = TextEditingController(text: 'candidate@careercraft.com');
    final recruiterEmailController = TextEditingController(text: 'recruiter@careercraft.com');
    
    DateTime selectedDate = DateTime.now().add(const Duration(days: 1));
    TimeOfDay selectedTime = const TimeOfDay(hour: 10, minute: 0);
    int durationMinutes = 30;

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF0F0C20),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Colors.white12)),
              title: const Row(
                children: [
                  Icon(Icons.calendar_month, color: Colors.deepPurpleAccent),
                  SizedBox(width: 8),
                  Text('Schedule AI Interview', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: titleController,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: const InputDecoration(labelText: 'Event Title', labelStyle: TextStyle(color: Colors.grey)),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: descController,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: const InputDecoration(labelText: 'Description', labelStyle: TextStyle(color: Colors.grey)),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () async {
                              final picked = await showDatePicker(
                                context: context,
                                initialDate: selectedDate,
                                firstDate: DateTime.now(),
                                lastDate: DateTime.now().add(const Duration(days: 365)),
                              );
                              if (picked != null) {
                                setDialogState(() {
                                  selectedDate = picked;
                                  dateController.text = "${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
                                });
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(border: Border.all(color: Colors.white24), borderRadius: BorderRadius.circular(8)),
                              child: Text(
                                "${selectedDate.year}-${selectedDate.month.toString().padLeft(2, '0')}-${selectedDate.day.toString().padLeft(2, '0')}",
                                style: const TextStyle(color: Colors.white70, fontSize: 12),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: InkWell(
                            onTap: () async {
                              final picked = await showTimePicker(
                                context: context,
                                initialTime: selectedTime,
                              );
                              if (picked != null) {
                                setDialogState(() {
                                  selectedTime = picked;
                                  timeController.text = "${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}";
                                });
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(border: Border.all(color: Colors.white24), borderRadius: BorderRadius.circular(8)),
                              child: Text(
                                "${selectedTime.hour.toString().padLeft(2, '0')}:${selectedTime.minute.toString().padLeft(2, '0')}",
                                style: const TextStyle(color: Colors.white70, fontSize: 12),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: candidateEmailController,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: const InputDecoration(labelText: 'Candidate Email', labelStyle: TextStyle(color: Colors.grey)),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: recruiterEmailController,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: const InputDecoration(labelText: 'Recruiter Email', labelStyle: TextStyle(color: Colors.grey)),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Duration:', style: TextStyle(color: Colors.white70, fontSize: 12)),
                        DropdownButton<int>(
                          dropdownColor: const Color(0xFF0F0C20),
                          value: durationMinutes,
                          items: const [
                            DropdownMenuItem(value: 15, child: Text('15 Min', style: TextStyle(color: Colors.white, fontSize: 12))),
                            DropdownMenuItem(value: 30, child: Text('30 Min', style: TextStyle(color: Colors.white, fontSize: 12))),
                            DropdownMenuItem(value: 45, child: Text('45 Min', style: TextStyle(color: Colors.white, fontSize: 12))),
                            DropdownMenuItem(value: 60, child: Text('60 Min', style: TextStyle(color: Colors.white, fontSize: 12))),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setDialogState(() {
                                durationMinutes = val;
                              });
                            }
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  onPressed: () async {
                    // Combine date and time
                    final scheduledDateTime = DateTime(
                      selectedDate.year,
                      selectedDate.month,
                      selectedDate.day,
                      selectedTime.hour,
                      selectedTime.minute,
                    );
                    
                    final messenger = ScaffoldMessenger.of(context);
                    Navigator.pop(context);

                    messenger.showSnackBar(
                      const SnackBar(content: Text('Contacting Google Calendar API services...')),
                    );

                    final result = await scheduleInterview(
                      title: titleController.text,
                      description: descController.text,
                      startTime: scheduledDateTime.toUtc().toIso8601String(),
                      durationMinutes: durationMinutes,
                      attendees: [candidateEmailController.text, recruiterEmailController.text],
                    );

                    if (result != null) {
                      final meetLink = result['meetLink'] ?? 'https://meet.google.com/mock-link';
                      final formattedDate = "${scheduledDateTime.year}-${scheduledDateTime.month.toString().padLeft(2, '0')}-${scheduledDateTime.day.toString().padLeft(2, '0')} at ${scheduledDateTime.hour.toString().padLeft(2, '0')}:${scheduledDateTime.minute.toString().padLeft(2, '0')}";

                      await _sendSystemMessage(
                        "📅 AUTOMATED MEETING SCHEDULED!\n\n"
                        "An interview invitation has been synchronised on Google Calendar.\n"
                        "🗓️ Date: $formattedDate\n"
                        "⏳ Duration: $durationMinutes minutes\n"
                        "🔗 Meet Link: $meetLink\n\n"
                        "Check your email inbox for standard invitations!"
                      );

                      messenger.showSnackBar(
                        const SnackBar(backgroundColor: Colors.green, content: Text('Google Calendar invitation generated and shared successfully!')),
                      );
                    } else {
                      messenger.showSnackBar(
                        const SnackBar(backgroundColor: Colors.red, content: Text('Scheduling failed. Verify network backend.')),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.deepPurpleAccent),
                  child: const Text('Schedule', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
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
    final myUid = user?.uid ?? chat['recruiterId'] ?? 'mock_recruiter_123';

    return Scaffold(
      backgroundColor: isDarkMode ? const Color(0xFF0F0C20) : Colors.white,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(chat['candidateName'] ?? 'Candidate Name', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            Text(chat['jobTitle'] ?? '', style: const TextStyle(color: Colors.grey, fontSize: 11)),
          ],
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: isDarkMode ? Colors.white : Colors.black),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline, color: Colors.tealAccent),
            tooltip: 'Candidate Profile Summary',
            onPressed: _showCandidatePreview,
          ),
          IconButton(
            icon: const Icon(Icons.calendar_month_outlined, color: Colors.deepPurpleAccent),
            tooltip: 'Schedule Google Meet Interview',
            onPressed: _scheduleMeeting,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
                  : _messages.isEmpty
                      ? const Center(child: Text('Start conversation with candidate...', style: TextStyle(color: Colors.grey, fontSize: 12)))
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.all(16.0),
                          itemCount: _messages.length,
                          itemBuilder: (context, idx) {
                            final msg = _messages[idx];
                            final isSystem = msg['senderId'] == 'system';
                            final isMe = msg['senderId'] == myUid;

                            if (isSystem) {
                              return Align(
                                alignment: Alignment.center,
                                child: Container(
                                  margin: const EdgeInsets.only(bottom: 16, top: 4),
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: Colors.deepPurpleAccent.withOpacity(0.08),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: Colors.deepPurpleAccent.withOpacity(0.2)),
                                  ),
                                  child: Text(
                                    msg['text'] ?? '',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(color: Colors.white70, fontSize: 11, height: 1.4, fontWeight: FontWeight.bold),
                                  ),
                                ),
                              );
                            }

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
            
            // Bottom Message Input Bar
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
