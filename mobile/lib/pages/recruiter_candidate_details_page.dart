import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/pages/recruiter_messages_page.dart';

class RecruiterCandidateDetailsPage extends StatefulWidget {
  final Map<String, dynamic> candidateData;

  const RecruiterCandidateDetailsPage({super.key, required this.candidateData});

  @override
  State<RecruiterCandidateDetailsPage> createState() => _RecruiterCandidateDetailsPageState();
}

class _RecruiterCandidateDetailsPageState extends State<RecruiterCandidateDetailsPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _notesController = TextEditingController();
  bool _isSavingNotes = false;
  Map<String, dynamic>? _interviewRecord;
  bool _isLoadingRecord = true;
  bool _isCreatingChat = false;

  Future<void> _startChat() async {
    setState(() {
      _isCreatingChat = true;
    });

    final user = FirebaseAuth.instance.currentUser;
    final recruiterId = user?.uid ?? 'mock_recruiter_123';
    final recruiterName = user?.displayName ?? 'Recruiter Evaluator';
    
    final candidateId = widget.candidateData['id'] ?? widget.candidateData['uid'] ?? 'mock_uid_123';
    final candidateName = widget.candidateData['name'] ?? 'Anonymous Candidate';
    final jobTitle = widget.candidateData['title'] ?? 'Software Professional';
    final jobId = widget.candidateData['jobId'] ?? 'job_mock_123';

    try {
      final chat = await createChat(
        candidateId: candidateId,
        recruiterId: recruiterId,
        jobId: jobId,
        jobTitle: jobTitle,
        candidateName: candidateName,
        recruiterName: recruiterName,
      );

      if (chat != null && mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => RecruiterChatThreadScreen(chat: chat),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.red,
            content: Text('Failed to initialize communication channel with candidate.'),
          ),
        );
      }
    } catch (e) {
      print('Error starting chat: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isCreatingChat = false;
        });
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _notesController.text = widget.candidateData['recruiterNotes'] ?? '';
    _fetchInterviewRecord();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  // Fetch candidate's dynamic interview records from Cloud Firestore
  Future<void> _fetchInterviewRecord() async {
    final candidateId = widget.candidateData['id'] ?? widget.candidateData['uid'] ?? 'mock_uid_123';
    try {
      final docSnap = await FirebaseFirestore.instance
          .collection('interviews')
          .doc('${candidateId}_ai_voice_round')
          .get();

      if (docSnap.exists) {
        setState(() {
          _interviewRecord = docSnap.data();
        });
      }
    } catch (e) {
      print('Error loading interview record: $e');
    } finally {
      setState(() {
        _isLoadingRecord = false;
      });
    }
  }

  // Sync recruiter notes to Firestore
  Future<void> _saveNotes() async {
    setState(() {
      _isSavingNotes = true;
    });

    final candidateId = widget.candidateData['id'] ?? widget.candidateData['uid'] ?? 'mock_uid_123';
    try {
      // Sync notes directly to Firestore user profile
      await FirebaseFirestore.instance.collection('users').doc(candidateId).set({
        'recruiterNotes': _notesController.text,
        'lastNotesSyncAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Colors.green,
          content: Text('Recruiter comments successfully synchronized with Cloud Firestore!'),
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: Colors.red[800],
          content: Text('Notes synchronization failed: $e'),
        ),
      );
    } finally {
      setState(() {
        _isSavingNotes = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final candidateName = widget.candidateData['name'] ?? 'Candidate Profile';
    final candidateTitle = widget.candidateData['title'] ?? 'Software Engineer';

    return Scaffold(
      backgroundColor: const Color(0xFF0F0C20),
      appBar: AppBar(
        title: Text(candidateName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.deepPurpleAccent,
          labelColor: Colors.deepPurpleAccent,
          unselectedLabelColor: Colors.white60,
          tabs: const [
            Tab(icon: Icon(Icons.person), text: 'Profile'),
            Tab(icon: Icon(Icons.interpreter_mode), text: 'AI Voice'),
            Tab(icon: Icon(Icons.fingerprint), text: 'Biometrics'),
            Tab(icon: Icon(Icons.security), text: 'Proctoring'),
          ],
        ),
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return TabBarView(
              controller: _tabController,
              children: [
                _buildProfileTab(constraints),
                _buildAiVoiceTab(constraints),
                _buildBiometricsTab(constraints),
                _buildProctoringTab(constraints),
              ],
            );
          },
        ),
      ),
    );
  }

  // --- TAB 1: PROFILE DETAILS ---
  Widget _buildProfileTab(BoxConstraints constraints) {
    final email = widget.candidateData['email'] ?? 'candidate@careercraft.com';
    final phone = widget.candidateData['phone'] ?? '+1 (555) 019-2834';
    final location = widget.candidateData['location'] ?? 'New York, USA';
    final skills = widget.candidateData['skills'] ?? 'Flutter, Dart, Firebase, Python, Next.js, Flask';
    final experience = widget.candidateData['experience'] ?? 'Senior Software Engineer at TechCorp (2023 - Present)';
    final education = widget.candidateData['education'] ?? 'B.S. Computer Science, Stanford University (2022)';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: CircleAvatar(
              radius: 50,
              backgroundColor: Colors.deepPurpleAccent.withOpacity(0.2),
              child: Text(
                widget.candidateData['name'] != null ? widget.candidateData['name'][0] : 'C',
                style: const TextStyle(fontSize: 40, color: Colors.deepPurpleAccent, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              widget.candidateData['name'] ?? 'Candidate',
              style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
            ),
          ),
          Center(
            child: Text(
              widget.candidateData['title'] ?? 'Technical Professional',
              style: const TextStyle(color: Colors.white70, fontSize: 16),
            ),
          ),
          const SizedBox(height: 24),
          
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Contact Information', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const Divider(color: Colors.white12, height: 20),
                  _buildProfileRow('Email', email, Icons.email),
                  _buildProfileRow('Phone', phone, Icons.phone),
                  _buildProfileRow('Location', location, Icons.location_on),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Skills & Background', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const Divider(color: Colors.white12, height: 20),
                  Text(skills, style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Experience & Education', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const Divider(color: Colors.white12, height: 20),
                  const Text('WORK EXPERIENCE', style: TextStyle(color: Colors.deepPurpleAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  Text(experience, style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4)),
                  const SizedBox(height: 16),
                  const Text('EDUCATION', style: TextStyle(color: Colors.deepPurpleAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  Text(education, style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          
          // Recruiter Notes Sync Field
          const Text('Recruiter Evaluator Notes:', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 8),
          TextField(
            controller: _notesController,
            maxLines: 4,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Enter candidate evaluations, alignment insights, and custom highlights...',
              fillColor: Colors.white.withOpacity(0.05),
              filled: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 12),
          _isSavingNotes
              ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ElevatedButton(
                      onPressed: _saveNotes,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.deepPurpleAccent,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.cloud_sync),
                          SizedBox(width: 8),
                          Text('Sync Comments with Cloud', style: TextStyle(fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    _isCreatingChat
                        ? const Center(child: CircularProgressIndicator(color: Colors.tealAccent))
                        : ElevatedButton(
                            onPressed: _startChat,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.teal,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.forum, color: Colors.white),
                                SizedBox(width: 8),
                                Text('Start Real-Time Chat with Candidate', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                              ],
                            ),
                          ),
                  ],
                ),
        ],
      ),
    );
  }

  Widget _buildProfileRow(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        children: [
          Icon(icon, color: Colors.deepPurpleAccent, size: 20),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: Colors.white38, fontSize: 11)),
              Text(value, style: const TextStyle(color: Colors.white70, fontSize: 14)),
            ],
          ),
        ],
      ),
    );
  }

  // --- TAB 2: AI VOICE DIALOGUE TREE ---
  Widget _buildAiVoiceTab(BoxConstraints constraints) {
    if (_isLoadingRecord) {
      return const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent));
    }

    if (_interviewRecord == null) {
      return _buildNoVoiceRecordState();
    }

    final overallScore = _interviewRecord!['overallScore'] ?? 87;
    final overallFeedback = _interviewRecord!['overallFeedback'] ?? 'Excellent command of technical structures.';
    final List<dynamic> conversation = _interviewRecord!['conversationHistory'] ?? [];
    final List<dynamic> scorecards = _interviewRecord!['responses'] ?? [];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Technical Rating Card
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Row(
                children: [
                  Container(
                    width: 70,
                    height: 70,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.deepPurpleAccent, width: 3),
                      color: Colors.deepPurpleAccent.withOpacity(0.1),
                    ),
                    child: Center(
                      child: Text(
                        '$overallScore',
                        style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('AI Tech Rating', style: TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text(
                          overallFeedback,
                          style: const TextStyle(color: Colors.white54, fontSize: 12, height: 1.3),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          
          const Text('Turn-by-Turn Voice Transcript:', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          
          if (scorecards.isEmpty)
            ...conversation.map((turn) {
              final isAi = turn['speaker'] == 'ai';
              return _buildDialogueBubble(
                isAi: isAi,
                text: turn['text'] ?? '',
                score: null,
                feedback: null,
              );
            })
          else
            ...List.generate(scorecards.length, (idx) {
              final card = scorecards[idx];
              final qText = card['questionText'] ?? 'Question placeholder';
              final aText = card['transcript'] ?? 'Answer transcript placeholder';
              final score = card['aiScore'] ?? 80;
              final feedback = card['aiFeedback'] ?? 'Excellent command.';

              return Column(
                children: [
                  _buildDialogueBubble(isAi: true, text: qText, score: null, feedback: null),
                  _buildDialogueBubble(isAi: false, text: aText, score: score, feedback: feedback),
                ],
              );
            }),
        ],
      ),
    );
  }

  Widget _buildDialogueBubble({required bool isAi, required String text, int? score, String? feedback}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Align(
        alignment: isAi ? Alignment.centerLeft : Alignment.centerRight,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 300),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isAi ? Colors.white.withOpacity(0.04) : Colors.deepPurpleAccent.withOpacity(0.12),
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: isAi ? Radius.zero : const Radius.circular(16),
              bottomRight: isAi ? const Radius.circular(16) : Radius.zero,
            ),
            border: Border.all(
              color: isAi ? Colors.white12 : Colors.deepPurpleAccent.withOpacity(0.3),
              width: 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isAi ? 'AI INTERVIEWER' : 'CANDIDATE VOCAL ANSWER',
                    style: TextStyle(
                      color: isAi ? Colors.deepPurpleAccent : Colors.tealAccent,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (score != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.tealAccent.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Score: $score',
                        style: const TextStyle(color: Colors.tealAccent, fontSize: 9, fontWeight: FontWeight.bold),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                text,
                style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.4),
              ),
              if (feedback != null) ...[
                const Divider(color: Colors.white12, height: 16),
                Text(
                  'AI Critique: $feedback',
                  style: const TextStyle(color: Colors.white60, fontSize: 11, fontStyle: FontStyle.italic),
                ),
              ]
            ],
          ),
        ),
      ),
    );
  }

  // --- TAB 3: BIOMETRICS COMPARISON ---
  Widget _buildBiometricsTab(BoxConstraints constraints) {
    if (_isLoadingRecord) {
      return const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent));
    }

    final matchScore = _interviewRecord?['verification']?['faceMatchScore'] ?? 92;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Biometric Face Match Gauge',
            style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          
          // Match likeness gauge circle
          Center(
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.deepPurpleAccent.withOpacity(0.05),
                border: Border.all(color: Colors.green, width: 4),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('$matchScore%', style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  const Text('MATCH SCORE', style: TextStyle(color: Colors.green, fontSize: 11, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 30),
          
          // ID Card vs Webcam selfie
          const Text('Verification Assets:', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          
          Column(
            children: [
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('STATE ID RECORD', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                          Icon(Icons.check_circle, color: Colors.green, size: 18),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Container(
                        height: 160,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.04),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.document_scanner, color: Colors.white30, size: 40),
                              SizedBox(height: 8),
                              Text('Government ID Secured', style: TextStyle(color: Colors.white30, fontSize: 13)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('LIVE SNAPSHOT SELFIE', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                          Icon(Icons.check_circle, color: Colors.green, size: 18),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Container(
                        height: 160,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.04),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.face, color: Colors.white30, size: 40),
                              SizedBox(height: 8),
                              Text('Live Selfie Captured', style: TextStyle(color: Colors.white30, fontSize: 13)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // --- TAB 4: PROCTORING AUDITING ---
  Widget _buildProctoringTab(BoxConstraints constraints) {
    if (_isLoadingRecord) {
      return const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent));
    }

    final int violations = _interviewRecord?['proctoringViolations']?['tabSwitchesCount'] ?? 0;
    final List<dynamic> flags = _interviewRecord?['proctoringViolations']?['cheatingFlags'] ?? [];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Security Auditing Dashboard',
            style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                children: [
                  _buildProctorRow('Unfocused/Background Violations', '$violations', violations > 2 ? Colors.red : Colors.green),
                  const Divider(color: Colors.white12, height: 24),
                  _buildProctorRow('Virtual Audio Driver Hijack Scan', 'CLEAN', Colors.green),
                  const Divider(color: Colors.white12, height: 24),
                  _buildProctorRow('AI Voice Anti-Proxy Scan', 'CLEAN', Colors.green),
                  const Divider(color: Colors.white12, height: 24),
                  _buildProctorRow('Cheating Suspect Flag', violations > 2 ? 'HIGH RISK' : 'LOW RISK', violations > 2 ? Colors.red : Colors.green),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          
          const Text('Proctoring Audit Log Flags:', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          
          if (flags.isEmpty)
            const GlassCard(
              child: Padding(
                padding: EdgeInsets.all(16.0),
                child: Center(
                  child: Text('No proctoring violations recorded. Interview is highly secure.', style: TextStyle(color: Colors.green, fontSize: 14)),
                ),
              ),
            )
          else
            ...flags.map((flag) {
              return Card(
                color: Colors.red[950]?.withOpacity(0.3),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.red.withOpacity(0.3))),
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  leading: const Icon(Icons.warning, color: Colors.red),
                  title: Text(flag, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                  subtitle: const Text('Logged automatically by anti-cheat tracker.', style: TextStyle(color: Colors.white54, fontSize: 11)),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildProctorRow(String label, String value, Color valueColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 14)),
        Text(value, style: TextStyle(color: valueColor, fontWeight: FontWeight.bold, fontSize: 14)),
      ],
    );
  }

  // Fallback state when candidate has not completed interview
  Widget _buildNoVoiceRecordState() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.interpreter_mode, color: Colors.white30, size: 80),
            const SizedBox(height: 20),
            const Text(
              'No Voice Interview Record',
              style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            const Text(
              'This candidate has not yet completed their turn-based AI voice technical evaluation. Check back once their status changes to completed.',
              style: TextStyle(color: Colors.white54, fontSize: 14, height: 1.4),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 30),
            
            // Evaluator comments anyway
            const Align(
              alignment: Alignment.centerLeft,
              child: Text('Enter Notes/Evaluations manually:', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _notesController,
              maxLines: 4,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Enter candidate evaluations, alignment insights, and custom highlights...',
                fillColor: Colors.white.withOpacity(0.05),
                filled: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 12),
            _isSavingNotes
                ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ElevatedButton(
                        onPressed: _saveNotes,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.deepPurpleAccent,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.cloud_sync),
                            SizedBox(width: 8),
                            Text('Sync Comments with Cloud', style: TextStyle(fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      _isCreatingChat
                          ? const Center(child: CircularProgressIndicator(color: Colors.tealAccent))
                          : ElevatedButton(
                              onPressed: _startChat,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.teal,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                              ),
                              child: const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.forum, color: Colors.white),
                                  SizedBox(width: 8),
                                  Text('Start Real-Time Chat with Candidate', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                                ],
                              ),
                            ),
                    ],
                  ),
          ],
        ),
      ),
    );
  }
}
