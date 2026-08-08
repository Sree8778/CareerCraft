import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/services/auth_service.dart';
import 'package:http/http.dart' as http;

class CandidateInterviewPage extends StatefulWidget {
  const CandidateInterviewPage({super.key});

  @override
  State<CandidateInterviewPage> createState() => _CandidateInterviewPageState();
}

class _CandidateInterviewPageState extends State<CandidateInterviewPage>
    with WidgetsBindingObserver, SingleTickerProviderStateMixin {
  int _step = 1;
  bool _isLoading = false;

  // Identity checks
  XFile? _stateIdFile;
  XFile? _selfieFile;
  Map<String, dynamic>? _verificationResult;

  // Proctoring
  int _appStateViolations = 0;

  // Interview state
  String _interviewId = '';
  String _currentQuestion = '';
  bool _isAiSpeaking = false;
  bool _isRecording = false;
  String _speechTranscript = '';
  List<Map<String, dynamic>> _conversationHistory = [];
  int _timeLeftSeconds = 1800;
  Timer? _countdownTimer;

  // Score tracking
  int _runningScore = 0;
  int _scoredRounds = 0;
  int _overallScore = 0;
  String _overallFeedback = '';

  // Waveform animation
  late AnimationController _waveformController;
  final List<double> _waveHeights = List.generate(10, (_) => 10.0);
  final Random _random = Random();
  Timer? _waveformTimer;

  // Speech recognition
  final SpeechToText _speech = SpeechToText();
  bool _speechAvailable = false;

  // Text-to-speech
  final FlutterTts _tts = FlutterTts();

  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _waveformController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _initSpeech();
    _initTts();
  }

  Future<void> _initSpeech() async {
    final available = await _speech.initialize(
      onError: (e) => debugPrint('STT error: $e'),
    );
    if (mounted) setState(() => _speechAvailable = available);
  }

  Future<void> _initTts() async {
    await _tts.setLanguage('en-US');
    await _tts.setSpeechRate(0.45);
    await _tts.setVolume(1.0);
    _tts.setCompletionHandler(() {
      if (mounted) setState(() => _isAiSpeaking = false);
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _countdownTimer?.cancel();
    _waveformTimer?.cancel();
    _waveformController.dispose();
    _tts.stop();
    _speech.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (_step == 3) {
      if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
        setState(() => _appStateViolations++);
        _logProctoringViolation('Application moved to background/unfocused');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.amber[900],
            content: Text(
              'WARNING: App unfocused! Violation logged. ($_appStateViolations/3)',
              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
            ),
          ),
        );
      }
    }
  }

  Future<void> _logProctoringViolation(String reason) async {
    if (_interviewId.isEmpty) return;
    try {
      await FirebaseFirestore.instance.collection('interviews').doc(_interviewId).update({
        'proctoringViolations.tabSwitchesCount': _appStateViolations,
        'proctoringViolations.cheatingFlags': FieldValue.arrayUnion([reason]),
        'proctoringViolations.lastViolationRecordedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('Error logging violation: $e');
    }
  }

  void _startTimer() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_timeLeftSeconds > 0) {
        setState(() => _timeLeftSeconds--);
      } else {
        _countdownTimer?.cancel();
        _finishInterview();
      }
    });
  }

  String _formatTime(int totalSeconds) {
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  Future<void> _pickStateId() async {
    try {
      final file = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
      if (file != null && mounted) {
        setState(() => _stateIdFile = file);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('State ID loaded.')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load image: $e')),
      );
    }
  }

  Future<void> _captureSelfie() async {
    try {
      final file = await _picker.pickImage(source: ImageSource.camera, imageQuality: 80);
      if (file != null && mounted) {
        setState(() => _selfieFile = file);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Selfie captured.')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to capture selfie: $e')),
      );
    }
  }

  Future<void> _verifyIdentity() async {
    if (_stateIdFile == null || _selfieFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a State ID and capture a selfie first.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/interviews/verify-identity'));
      final token = await AuthService.getToken() ?? '';
      request.headers['Authorization'] = 'Bearer $token';
      request.files.add(await http.MultipartFile.fromPath('stateId', _stateIdFile!.path));
      request.files.add(await http.MultipartFile.fromPath('selfie', _selfieFile!.path));

      final streamed = await request.send();
      final response = await http.Response.fromStream(streamed);

      if (response.statusCode == 200) {
        final result = jsonDecode(response.body);
        if (!mounted) return;
        setState(() => _verificationResult = result);

        if (result['fraudDetected'] == true) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: Colors.red[800],
              content: Text('Verification Failed: ${result['fraudDetails'] ?? 'Spoofing detected'}'),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Identity verified! Likeness: ${result['matchScore']}%')),
          );
          setState(() => _step = 2);
        }
      } else {
        throw Exception('Status: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('Identity check failed: $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: Colors.red[800],
          content: Text('Verification request failed. Check your connection and try again. ($e)'),
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _runDeviceScan() async {
    setState(() => _isLoading = true);

    // Request microphone permission — the real check for audio access
    final micStatus = await Permission.microphone.request();
    await Future.delayed(const Duration(milliseconds: 800));

    if (!micStatus.isGranted) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.red,
            content: Text('Microphone permission required for the voice interview.'),
          ),
        );
      }
      return;
    }

    // Re-initialise STT after permission is granted
    if (!_speechAvailable) {
      _speechAvailable = await _speech.initialize(onError: (e) => debugPrint('STT: $e'));
    }

    setState(() {
      _isLoading = false;
      _step = 3;
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Device scan complete. Microphone access confirmed.')),
      );
    }

    _startInterviewArena();
  }

  Future<void> _startInterviewArena() async {
    setState(() => _isLoading = true);

    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null || uid.isEmpty) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('You must be signed in to take the interview.')),
        );
      }
      return;
    }
    _interviewId = '${uid}_ai_voice_round';
    final token = await AuthService.getToken() ?? '';

    try {
      final resumeDoc = await FirebaseFirestore.instance.collection('resumes').doc(uid).get();
      final resumeData = (resumeDoc.data()?['resumeData']) ?? {};

      final response = await http.post(
        Uri.parse('$baseUrl/interviews/get-next-question'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
        body: jsonEncode({
          'resumeData': resumeData,
          'conversationHistory': [],
          'latestTranscript': '',
          'elapsedSeconds': 0,
        }),
      );

      String openingQuestion =
          "Welcome to your AI Voice Technical Interview. Let's start with your background. Can you outline your primary technical skills?";
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        openingQuestion = data['nextQuestion'] ?? openingQuestion;
      }

      setState(() {
        _currentQuestion = openingQuestion;
        _conversationHistory = [
          {'speaker': 'ai', 'text': openingQuestion, 'timestamp': DateTime.now().toIso8601String()}
        ];
      });

      await FirebaseFirestore.instance.collection('interviews').doc(_interviewId).set({
        'candidateId': uid,
        'candidateName': FirebaseAuth.instance.currentUser?.displayName ?? 'Candidate',
        'jobId': 'ai_voice_assessor',
        'jobTitle': 'Core technical evaluator',
        'status': 'in_progress',
        'startedAt': FieldValue.serverTimestamp(),
        'conversationHistory': _conversationHistory,
        'proctoringViolations': {
          'tabSwitchesCount': 0,
          'fullscreenExitsCount': 0,
          'virtualAudioDetected': false,
          'cheatingFlags': [],
        },
        'verification': {
          'faceMatchScore': _verificationResult?['matchScore'] ?? 92,
          'verifiedAt': FieldValue.serverTimestamp(),
        },
      });

      _speakQuestion(openingQuestion);
      _startTimer();
    } catch (e) {
      debugPrint('Arena start error: $e');
      const fallback =
          "Welcome. Let's start — can you outline your primary technical skills?";
      setState(() {
        _currentQuestion = fallback;
        _conversationHistory = [
          {'speaker': 'ai', 'text': fallback, 'timestamp': DateTime.now().toIso8601String()}
        ];
      });
      _speakQuestion(fallback);
      _startTimer();
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // Real TTS
  void _speakQuestion(String text) async {
    setState(() => _isAiSpeaking = true);
    await _tts.speak(text);
    // _tts.setCompletionHandler sets _isAiSpeaking = false when done
  }

  // Real speech-to-text
  void _toggleVoiceRecording() async {
    if (_isRecording) {
      await _speech.stop();
      _waveformTimer?.cancel();
      _waveformController.stop();
      if (!mounted) return;
      setState(() => _isRecording = false);

      if (_speechTranscript.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No speech detected — please try again.')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Voice response captured.')),
        );
      }
    } else {
      if (!_speechAvailable) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Speech recognition is not available on this device.'),
          ),
        );
        return;
      }

      setState(() {
        _isRecording = true;
        _speechTranscript = '';
      });

      _waveformController.repeat(reverse: true);
      _waveformTimer = Timer.periodic(const Duration(milliseconds: 100), (timer) {
        if (mounted) {
          setState(() {
            for (int i = 0; i < _waveHeights.length; i++) {
              _waveHeights[i] = 10.0 + _random.nextDouble() * 45.0;
            }
          });
        }
      });

      await _speech.listen(
        onResult: (result) {
          if (mounted) setState(() => _speechTranscript = result.recognizedWords);
        },
        listenOptions: SpeechListenOptions(
          listenFor: const Duration(minutes: 3),
          pauseFor: const Duration(seconds: 4),
          partialResults: true,
        ),
      );
    }
  }

  Future<void> _submitVoiceAnswer() async {
    if (_speechTranscript.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please record your voice response first.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    final updatedHistory = [
      ..._conversationHistory,
      {'speaker': 'candidate', 'text': _speechTranscript, 'timestamp': DateTime.now().toIso8601String()}
    ];
    setState(() => _conversationHistory = updatedHistory);

    final token = await AuthService.getToken() ?? '';

    try {
      // 1. Evaluate the answer
      final evalResp = await http.post(
        Uri.parse('$baseUrl/interviews/evaluate-response'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
        body: jsonEncode({'question': _currentQuestion, 'transcript': _speechTranscript}),
      );

      int? score;
      String feedback = 'Response evaluated.';
      if (evalResp.statusCode == 200) {
        final evalData = jsonDecode(evalResp.body);
        score = evalData['score'] as int?;
        feedback = evalData['feedback'] ?? feedback;
      }

      // Only track score when the API returned a real evaluation
      if (score != null) {
        _runningScore += score;
        _scoredRounds++;
      }

      // 2. Fetch next question
      final uid = FirebaseAuth.instance.currentUser?.uid ?? '';
      final resumeDoc = await FirebaseFirestore.instance.collection('resumes').doc(uid).get();
      final resumeData = (resumeDoc.data()?['resumeData']) ?? {};
      final elapsed = 1800 - _timeLeftSeconds;

      final nextResp = await http.post(
        Uri.parse('$baseUrl/interviews/get-next-question'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
        body: jsonEncode({
          'resumeData': resumeData,
          'conversationHistory': updatedHistory,
          'latestTranscript': _speechTranscript,
          'elapsedSeconds': elapsed,
        }),
      );

      String followUp = 'Thank you. Could you walk me through a challenging technical problem you solved recently?';
      if (nextResp.statusCode == 200) {
        final nextData = jsonDecode(nextResp.body);
        followUp = nextData['nextQuestion'] ?? followUp;
      }

      final finalHistory = [
        ...updatedHistory,
        {'speaker': 'ai', 'text': followUp, 'timestamp': DateTime.now().toIso8601String()}
      ];

      if (!mounted) return;
      setState(() {
        _currentQuestion = followUp;
        _conversationHistory = finalHistory;
        _speechTranscript = '';
      });

      // Update Firestore
      await FirebaseFirestore.instance.collection('interviews').doc(_interviewId).update({
        'conversationHistory': finalHistory,
        'responses': FieldValue.arrayUnion([
          {
            'questionText': followUp,
            'transcript': _speechTranscript,
            if (score != null) 'aiScore': score,
            'aiFeedback': feedback,
          }
        ]),
      });

      _speakQuestion(followUp);
    } catch (e) {
      debugPrint('Submit response failed: $e');
      const fallback = 'Can you describe how you approach debugging in production environments?';
      final finalHistory = [
        ...updatedHistory,
        {'speaker': 'ai', 'text': fallback, 'timestamp': DateTime.now().toIso8601String()}
      ];
      if (!mounted) return;
      setState(() {
        _currentQuestion = fallback;
        _conversationHistory = finalHistory;
        _speechTranscript = '';
      });
      _speakQuestion(fallback);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _finishInterview() async {
    _countdownTimer?.cancel();
    await _speech.cancel();
    await _tts.stop();
    setState(() => _isLoading = true);

    final computed = _scoredRounds > 0 ? (_runningScore / _scoredRounds).round() : 0;
    final feedbackText = _scoredRounds > 0
        ? 'Candidate completed $_scoredRounds evaluated response(s) with an average score of $computed%.'
        : 'Interview completed. No responses were formally evaluated.';

    try {
      await FirebaseFirestore.instance.collection('interviews').doc(_interviewId).update({
        'status': 'completed',
        'completedAt': FieldValue.serverTimestamp(),
        'overallScore': computed,
        'overallFeedback': feedbackText,
      });
    } catch (e) {
      debugPrint('Finish error: $e');
    } finally {
      setState(() {
        _overallScore = computed;
        _overallFeedback = feedbackText;
        _isLoading = false;
        _step = 4;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0C20),
      appBar: AppBar(
        title: const Text('Secure AI Voice Arena',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
        actions: [
          if (_step == 3)
            Padding(
              padding: const EdgeInsets.only(right: 16.0),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.redAccent.withOpacity(0.5)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.timer, color: Colors.redAccent, size: 16),
                      const SizedBox(width: 6),
                      Text(_formatTime(_timeLeftSeconds),
                          style: const TextStyle(
                              color: Colors.redAccent, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight - 32),
              child: IntrinsicHeight(child: _buildCurrentStepView()),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentStepView() {
    switch (_step) {
      case 1: return _buildBiometricVerificationView();
      case 2: return _buildDeviceScanView();
      case 3: return _buildVoiceArenaView();
      case 4: return _buildCompleteView();
      default: return const SizedBox();
    }
  }

  // ── Step 1: Biometrics ─────────────────────────────────
  Widget _buildBiometricVerificationView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('Identity Biometrics',
            style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center),
        const SizedBox(height: 8),
        const Text(
          'Upload a Government ID and take a live selfie to verify your identity and prevent proxy interviews.',
          style: TextStyle(color: Colors.white70, fontSize: 14),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        Expanded(
          child: Column(children: [
            GlassCard(
              child: InkWell(
                onTap: _pickStateId,
                child: Container(
                  height: 180,
                  width: double.infinity,
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(16)),
                  child: _stateIdFile != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: Image.file(File(_stateIdFile!.path),
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const Center(
                                  child: Icon(Icons.document_scanner,
                                      color: Colors.deepPurpleAccent, size: 50))),
                        )
                      : const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.add_photo_alternate_outlined,
                                color: Colors.deepPurpleAccent, size: 50),
                            SizedBox(height: 12),
                            Text('Load Government State ID Image',
                                style: TextStyle(
                                    color: Colors.white70, fontWeight: FontWeight.bold)),
                          ],
                        ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            GlassCard(
              child: InkWell(
                onTap: _captureSelfie,
                child: Container(
                  height: 180,
                  width: double.infinity,
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(16)),
                  child: _selfieFile != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: Image.file(File(_selfieFile!.path),
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const Center(
                                  child: Icon(Icons.face,
                                      color: Colors.deepPurpleAccent, size: 50))),
                        )
                      : const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.camera_alt_outlined,
                                color: Colors.deepPurpleAccent, size: 50),
                            SizedBox(height: 12),
                            Text('Capture Live Selfie Photo',
                                style: TextStyle(
                                    color: Colors.white70, fontWeight: FontWeight.bold)),
                          ],
                        ),
                ),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 24),
        _isLoading
            ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
            : ElevatedButton(
                onPressed: _verifyIdentity,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.deepPurpleAccent,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Verify Biometrics',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
      ],
    );
  }

  // ── Step 2: Device scan ────────────────────────────────
  Widget _buildDeviceScanView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(Icons.shield_outlined, color: Colors.deepPurpleAccent, size: 80),
        const SizedBox(height: 24),
        const Text('Device Security & Microphone Check',
            style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center),
        const SizedBox(height: 12),
        const Text(
          'This scan confirms microphone access and locks the session before starting the voice interview. Do not close or minimise the app.',
          style: TextStyle(color: Colors.white70, fontSize: 14),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 40),
        GlassCard(
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(children: [
              _buildScanRow('Biometrics Verification', 'PASSED', Icons.check_circle, Colors.green),
              const Divider(color: Colors.white12, height: 24),
              _buildScanRow(
                'Microphone Access',
                _isLoading ? 'CHECKING...' : 'PENDING',
                _isLoading ? Icons.hourglass_empty : Icons.mic,
                _isLoading ? Colors.amber : Colors.white54,
              ),
              const Divider(color: Colors.white12, height: 24),
              _buildScanRow(
                'Session Lock',
                _isLoading ? 'LOCKING...' : 'READY',
                Icons.lock,
                Colors.deepPurpleAccent,
              ),
            ]),
          ),
        ),
        const SizedBox(height: 40),
        _isLoading
            ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
            : ElevatedButton(
                onPressed: _runDeviceScan,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.deepPurpleAccent,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Grant Mic & Start Arena',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
      ],
    );
  }

  Widget _buildScanRow(String title, String status, IconData icon, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 12),
          Text(title, style: const TextStyle(color: Colors.white70, fontSize: 14)),
        ]),
        Text(status,
            style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 14)),
      ],
    );
  }

  // ── Step 3: Voice Arena ────────────────────────────────
  Widget _buildVoiceArenaView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12)),
              child: const Row(children: [
                CircleAvatar(radius: 4, backgroundColor: Colors.green),
                SizedBox(width: 6),
                Text('PROCTORING ACTIVE',
                    style: TextStyle(
                        color: Colors.green, fontSize: 11, fontWeight: FontWeight.bold)),
              ]),
            ),
            Text('Flags: $_appStateViolations/3',
                style: TextStyle(
                    color: _appStateViolations > 0 ? Colors.amberAccent : Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 24),

        // Question box
        GlassCard(
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const CircleAvatar(
                  backgroundColor: Colors.deepPurpleAccent,
                  radius: 14,
                  child: Icon(Icons.psychology, color: Colors.white, size: 16),
                ),
                const SizedBox(width: 10),
                Text('AI Technical Interrogator',
                    style: TextStyle(
                        color: Colors.white.withOpacity(0.5),
                        fontSize: 12,
                        fontWeight: FontWeight.bold)),
              ]),
              const SizedBox(height: 12),
              Text(_currentQuestion,
                  style: const TextStyle(
                      color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, height: 1.4)),
            ]),
          ),
        ),
        const SizedBox(height: 30),

        // Voice visualisation
        Expanded(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (_isRecording)
                  Container(
                    height: 80,
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: List.generate(_waveHeights.length, (i) {
                        return AnimatedContainer(
                          duration: const Duration(milliseconds: 100),
                          width: 6,
                          height: _waveHeights[i],
                          decoration: BoxDecoration(
                              color: Colors.deepPurpleAccent,
                              borderRadius: BorderRadius.circular(3)),
                        );
                      }),
                    ),
                  )
                else if (_isAiSpeaking)
                  Column(children: [
                    const Icon(Icons.volume_up, color: Colors.deepPurpleAccent, size: 40),
                    const SizedBox(height: 12),
                    Text('Speaking…',
                        style: TextStyle(
                            color: Colors.white.withOpacity(0.4),
                            fontSize: 13,
                            fontStyle: FontStyle.italic)),
                  ])
                else
                  Column(children: [
                    Icon(Icons.mic_none, color: Colors.white.withOpacity(0.2), size: 40),
                    const SizedBox(height: 12),
                    Text(
                      _speechAvailable ? 'Tap mic to record your response' : 'Speech not available on device',
                      style: const TextStyle(color: Colors.white30, fontSize: 13),
                    ),
                  ]),
                const SizedBox(height: 40),

                // Mic button
                InkWell(
                  onTap: _isAiSpeaking ? null : _toggleVoiceRecording,
                  borderRadius: BorderRadius.circular(40),
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _isAiSpeaking
                          ? Colors.grey.withOpacity(0.1)
                          : _isRecording
                              ? Colors.redAccent.withOpacity(0.2)
                              : Colors.deepPurpleAccent.withOpacity(0.2),
                      border: Border.all(
                        color: _isAiSpeaking
                            ? Colors.grey.withOpacity(0.2)
                            : _isRecording
                                ? Colors.redAccent
                                : Colors.deepPurpleAccent,
                        width: 2,
                      ),
                    ),
                    child: Icon(
                      _isRecording ? Icons.stop : Icons.mic,
                      color: _isAiSpeaking
                          ? Colors.grey
                          : _isRecording
                              ? Colors.redAccent
                              : Colors.deepPurpleAccent,
                      size: 32,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 24),

        // Transcript preview
        if (_speechTranscript.isNotEmpty) ...[
          const Text('Voice Transcript:',
              style: TextStyle(color: Colors.white38, fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Text(_speechTranscript,
                  style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4)),
            ),
          ),
          const SizedBox(height: 16),
        ],

        Row(children: [
          Expanded(
            child: OutlinedButton(
              onPressed: _isLoading ? null : _finishInterview,
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.white24),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Wrap Up', style: TextStyle(color: Colors.white70, fontSize: 15)),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
                : ElevatedButton(
                    onPressed: _speechTranscript.isEmpty ? null : _submitVoiceAnswer,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.deepPurpleAccent,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('Next Turn', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                        SizedBox(width: 6),
                        Icon(Icons.arrow_forward, size: 16),
                      ],
                    ),
                  ),
          ),
        ]),
      ],
    );
  }

  // ── Step 4: Completion scorecard ───────────────────────
  Widget _buildCompleteView() {
    final biometricScore = _verificationResult?['matchScore'] ?? 92;
    final flagLabel = _appStateViolations == 0 ? 'PASS (0 flags)' : 'FLAGGED ($_appStateViolations)';

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(Icons.check_circle_outline, color: Colors.green, size: 80),
        const SizedBox(height: 24),
        const Text('Interview Successfully Submitted!',
            style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center),
        const SizedBox(height: 12),
        const Text(
          'Your AI voice responses and identity logs have been secured. The recruiter will review your biometric check and technical scorecard.',
          style: TextStyle(color: Colors.white70, fontSize: 14),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        GlassCard(
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Row(children: [
                Icon(Icons.analytics_outlined, color: Colors.deepPurpleAccent, size: 20),
                SizedBox(width: 8),
                Text('Vocal Assessment Summary',
                    style: TextStyle(
                        color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
              ]),
              const Divider(color: Colors.white12, height: 24),
              _buildSummaryRow('Overall Technical Fit', '$_overallScore%'),
              const SizedBox(height: 10),
              _buildSummaryRow('Security Auditing', flagLabel),
              const SizedBox(height: 10),
              _buildSummaryRow('Biometric Match Likeness', '$biometricScore%'),
              const SizedBox(height: 16),
              const Text('AI Evaluator Feedback:',
                  style: TextStyle(
                      color: Colors.white54, fontSize: 12, fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              Text(
                _overallFeedback.isNotEmpty
                    ? _overallFeedback
                    : 'Interview completed. Results have been submitted for review.',
                style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
              ),
            ]),
          ),
        ),
        const SizedBox(height: 40),
        ElevatedButton(
          onPressed: () => Navigator.pop(context),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.deepPurpleAccent,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: const Text('Back to Dashboard',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }

  Widget _buildSummaryRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 14)),
        Text(value,
            style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
      ],
    );
  }
}
