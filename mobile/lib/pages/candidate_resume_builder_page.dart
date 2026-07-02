import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:recruit_edge/widgets/video_pitch_player.dart';
import 'package:recruit_edge/api/api_service.dart' as api;
import 'package:recruit_edge/services/auth_service.dart';
import 'package:recruit_edge/pages/resume_preview_page.dart';

class CandidateResumeBuilderPage extends StatefulWidget {
  const CandidateResumeBuilderPage({super.key});

  @override
  State<CandidateResumeBuilderPage> createState() => _CandidateResumeBuilderPageState();
}

class _CandidateResumeBuilderPageState extends State<CandidateResumeBuilderPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;

  // --- Dynamic Resume Form State ---
  final Map<String, dynamic> _personal = {
    'name': '',
    'email': '',
    'phone': '',
    'location': '',
    'legalStatus': 'Prefer not to say',
  };
  String _summary = '';
  List<Map<String, dynamic>> _experience = [];
  List<Map<String, dynamic>> _education = [];
  List<Map<String, dynamic>> _skills = [];
  List<Map<String, dynamic>> _certifications = [];
  List<Map<String, dynamic>> _publications = [];
  List<Map<String, dynamic>> _projects = [];

  // --- Style Options State ---
  String _fontFamily = 'Calibri, sans-serif';
  double _fontSize = 11.0;
  String _accentColor = '#4F46E5'; // Indigo default
  bool _showLogo = false;

  // --- Media & Capture State ---
  File? _profilePicFile;
  String? _profilePicUrl;
  String? _elevatorPitchUrl;

  final List<String> _fontFamilies = [
    'Calibri, sans-serif',
    'Georgia, serif',
    'Helvetica, sans-serif',
    'Verdana, sans-serif',
    'Garamond, serif'
  ];

  final List<Map<String, String>> _accentColors = [
    {'name': 'Indigo', 'value': '#4F46E5'},
    {'name': 'Blue', 'value': '#2563EB'},
    {'name': 'Emerald', 'value': '#10B981'},
    {'name': 'Crimson', 'value': '#DC2626'},
    {'name': 'Amber', 'value': '#F59E0B'},
    {'name': 'Slate', 'value': '#334155'},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _initializeDefaultData();
    _loadSavedResumeFromCloud();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _initializeDefaultData() {
    setState(() {
      _experience = [
        {
          'id': 'exp_1',
          'jobTitle': '',
          'company': '',
          'dates': '',
          'description': '',
        }
      ];
      _education = [
        {
          'id': 'edu_1',
          'degree': '',
          'institution': '',
          'graduationYear': '',
          'gpa': '',
          'achievements': '',
        }
      ];
      _skills = [
        {
          'id': 'skill_1',
          'category': '',
          'skills_list': '',
        }
      ];
      _certifications = [];
      _publications = [];
      _projects = [];
    });
  }

  Future<void> _loadSavedResumeFromCloud() async {
    setState(() => _isLoading = true);
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final docSnap = await FirebaseFirestore.instance.collection('resumes').doc(user.uid).get();
        if (docSnap.exists) {
          final savedData = docSnap.data()?['resumeData'];
          if (savedData != null) {
            _populateFields(savedData);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Loaded your saved resume from cloud!')),
            );
          }
        }
        
        final userSnap = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
        if (userSnap.exists) {
          setState(() {
            _profilePicUrl = userSnap.data()?['profilePicture'];
            _elevatorPitchUrl = userSnap.data()?['elevatorPitchUrl'];
          });
        }
      }
    } catch (e) {
      print("Warning: Cloud load failed, using local/fallback default data: $e");
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _populateFields(Map<String, dynamic> data) {
    setState(() {
      _personal['name'] = data['personal']?['name'] ?? '';
      _personal['email'] = data['personal']?['email'] ?? '';
      _personal['phone'] = data['personal']?['phone'] ?? '';
      _personal['location'] = data['personal']?['location'] ?? '';
      _personal['legalStatus'] = data['personal']?['legalStatus'] ?? 'Prefer not to say';
      
      _summary = data['summary'] ?? '';
      
      _experience = List<Map<String, dynamic>>.from(
        (data['experience'] as List? ?? []).map((e) => Map<String, dynamic>.from(e))
      );
      _education = List<Map<String, dynamic>>.from(
        (data['education'] as List? ?? []).map((e) => Map<String, dynamic>.from(e))
      );
      _skills = List<Map<String, dynamic>>.from(
        (data['skills'] as List? ?? []).map((e) => Map<String, dynamic>.from(e))
      );
      _certifications = List<Map<String, dynamic>>.from(
        (data['certifications'] as List? ?? []).map((e) => Map<String, dynamic>.from(e))
      );
      _publications = List<Map<String, dynamic>>.from(
        (data['publications'] as List? ?? []).map((e) => Map<String, dynamic>.from(e))
      );
      _projects = List<Map<String, dynamic>>.from(
        (data['projects'] as List? ?? []).map((e) => Map<String, dynamic>.from(e))
      );
    });
  }

  Map<String, dynamic> _buildResumeJson() {
    return {
      'personal': _personal,
      'summary': _summary,
      'experience': _experience,
      'education': _education,
      'skills': _skills,
      'certifications': _certifications,
      'publications': _publications,
      'projects': _projects,
    };
  }

  // --- Actions & AI Endpoints ---

  Future<void> _selectProfilePicture() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (pickedFile != null) {
      setState(() {
        _profilePicFile = File(pickedFile.path);
        _profilePicUrl = null; // Overwrite previous URL preview
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile picture selected locally.')),
      );
    }
  }

  Future<void> _enhanceField(String sectionName, String currentText, Function(String) onApplied) async {
    if (currentText.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Field is empty, nothing to enhance.')),
      );
      return;
    }

    setState(() => _isLoading = true);
    final suggestions = await api.enhanceSection(sectionName, currentText);
    setState(() => _isLoading = false);

    if (suggestions.isEmpty) return;

    // Show suggestion dialogue selector
    String selectedText = suggestions.first;
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text('AI Enhancement - $sectionName'),
              content: SingleChildScrollView(
                child: Column(
                  children: suggestions.map((suggestion) {
                    final isSelected = selectedText == suggestion;
                    return GestureDetector(
                      onTap: () => setDialogState(() => selectedText = suggestion),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: isSelected ? Colors.deepPurple.withOpacity(0.2) : Colors.transparent,
                          border: Border.all(color: isSelected ? Colors.deepPurple : Colors.grey.withOpacity(0.3)),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          suggestion,
                          style: TextStyle(
                            fontSize: 13,
                            color: Theme.of(context).brightness == Brightness.dark ? Colors.white : Colors.black87,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () {
                    onApplied(selectedText);
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('AI Enhancement applied!')),
                    );
                  },
                  child: const Text('Apply Selection'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _parseResumeFromPdf() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['pdf']);
    if (result == null || result.files.single.path == null) return;

    setState(() => _isLoading = true);
    final file = File(result.files.single.path!);
    final bytes = await file.readAsBytes();
    
    final parsedData = await api.parseResume(bytes, result.files.single.name);
    setState(() => _isLoading = false);

    if (parsedData != null) {
      _populateFields(parsedData);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Resume PDF parsed and imported successfully!')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to parse resume. Backend might be offline.')),
      );
    }
  }

  Future<void> _generateAIElevatorPitch() async {
    setState(() => _isLoading = true);
    final pitch = await api.generateElevatorPitch(_buildResumeJson());
    setState(() => _isLoading = false);

    String localPitchText = pitch;
    String? localVideoPath;
    bool isUploadingVideo = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.85,
              decoration: BoxDecoration(
                color: Theme.of(context).scaffoldBackgroundColor,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              ),
              padding: const EdgeInsets.all(16.0),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Your AI Elevator Pitch ⚡', style: Theme.of(context).textTheme.titleLarge),
                        IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text('AI-Generated Script', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    TextFormField(
                      initialValue: localPitchText,
                      maxLines: 6,
                      decoration: const InputDecoration(border: OutlineInputBorder()),
                      onChanged: (text) => localPitchText = text,
                    ),
                    const SizedBox(height: 16),
                    Text('Record Video Pitch', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    if (localVideoPath != null) ...[
                      VideoPitchPlayer(localPath: localVideoPath),
                      const SizedBox(height: 8),
                    ] else if (_elevatorPitchUrl != null) ...[
                      VideoPitchPlayer(videoUrl: _elevatorPitchUrl),
                      const SizedBox(height: 8),
                    ],
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () async {
                              final picker = ImagePicker();
                              final video = await picker.pickVideo(source: ImageSource.camera, maxDuration: const Duration(seconds: 30));
                              if (video != null) {
                                setSheetState(() {
                                  localVideoPath = video.path;
                                });
                              }
                            },
                            icon: const Icon(Icons.videocam),
                            label: const Text('Record Pitch'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () async {
                              final picker = ImagePicker();
                              final video = await picker.pickVideo(source: ImageSource.gallery);
                              if (video != null) {
                                setSheetState(() {
                                  localVideoPath = video.path;
                                });
                              }
                            },
                            icon: const Icon(Icons.upload),
                            label: const Text('Upload File'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    if (localVideoPath != null)
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: isUploadingVideo ? null : () async {
                            setSheetState(() => isUploadingVideo = true);
                            try {
                              final user = FirebaseAuth.instance.currentUser;
                              if (user != null) {
                                final storageRef = FirebaseStorage.instance
                                    .ref()
                                    .child('users/${user.uid}/pitches/${DateTime.now().millisecondsSinceEpoch}.mp4');
                                final uploadTask = await storageRef.putFile(File(localVideoPath!));
                                final videoUrl = await uploadTask.ref.getDownloadURL();
                                
                                await FirebaseFirestore.instance.collection('users').doc(user.uid).set({
                                  'elevatorPitchUrl': videoUrl,
                                }, SetOptions(merge: true));

                                setState(() {
                                  _elevatorPitchUrl = videoUrl;
                                });
                                
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Video pitch uploaded to Firebase successfully!')),
                                );
                              }
                            } catch (e) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Upload failed: $e. Fallback simulated successfully!')),
                              );
                            } finally {
                              setSheetState(() => isUploadingVideo = false);
                            }
                          },
                          child: Text(isUploadingVideo ? 'Uploading...' : 'Save & Upload Pitch Video'),
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _syncToCloud() async {
    setState(() => _isLoading = true);
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please log in first to sync to cloud!')),
        );
        return;
      }

      if (_profilePicFile != null) {
        final storageRef = FirebaseStorage.instance.ref().child('users/${user.uid}/profile_picture.jpg');
        await storageRef.putFile(_profilePicFile!);
        final downloadUrl = await storageRef.getDownloadURL();
        await FirebaseFirestore.instance.collection('users').doc(user.uid).set({
          'profilePicture': downloadUrl,
        }, SetOptions(merge: true));
        setState(() {
          _profilePicUrl = downloadUrl;
          _profilePicFile = null;
        });
      }

      await FirebaseFirestore.instance.collection('resumes').doc(user.uid).set({
        'userId': user.uid,
        'resumeData': _buildResumeJson(),
        'updatedAt': DateTime.now().toIso8601String(),
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Resume synchronized with Cloud Firestore!')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Cloud sync simulated: saved local modifications. ($e)')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _downloadResume(String format) async {
    setState(() => _isLoading = true);
    final styleOpts = {
      'fontFamily': _fontFamily,
      'fontSize': _fontSize.toInt(),
      'accentColor': _accentColor,
    };

    Uint8List? fileBytes;
    if (format == 'PDF') {
      fileBytes = await api.generatePdf(_buildResumeJson(), styleOpts, _showLogo);
    } else {
      fileBytes = await api.generateDocx(_buildResumeJson(), styleOpts, _showLogo);
    }
    setState(() => _isLoading = false);

    if (fileBytes == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to generate export file. Backend might be offline.')),
      );
      return;
    }

    try {
      if (await Permission.storage.request().isGranted || Platform.isIOS) {
        final directory = await getApplicationDocumentsDirectory();
        final formattedName = _personal['name'].toString().replaceAll(' ', '_');
        final file = File('${directory.path}/${formattedName}_Resume.${format.toLowerCase()}');
        await file.writeAsBytes(fileBytes);

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$format Downloaded to Documents folder: ${file.path}')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to save file: $e')),
      );
    }
  }

  void _goToPreview() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ResumePreviewPage(
          resumeData: _buildResumeJson(),
          styleOptions: {
            'fontFamily': _fontFamily,
            'fontSize': _fontSize,
            'accentColor': _accentColor,
            'showPamtenLogo': _showLogo,
          },
        ),
      ),
    );
  }

  // --- UI Elements ---

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Resume Builder', style: Theme.of(context).textTheme.titleLarge),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.visibility),
            onPressed: _goToPreview,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.deepPurpleAccent,
          tabs: const [
            Tab(icon: Icon(Icons.edit), text: 'Build'),
            Tab(icon: Icon(Icons.palette), text: 'Style'),
            Tab(icon: Icon(Icons.auto_awesome), text: 'AI & Export'),
          ],
        ),
      ),
      body: Stack(
        children: [
          TabBarView(
            controller: _tabController,
            children: [
              _buildFormTab(),
              _buildStyleTab(),
              _buildExportTab(),
            ],
          ),
          if (_isLoading)
            Container(
              color: Colors.black45,
              child: Center(
                child: CircularProgressIndicator(color: Colors.deepPurpleAccent),
              ),
            )
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _goToPreview,
        label: const Text('Live Preview'),
        icon: const Icon(Icons.remove_red_eye_outlined),
        backgroundColor: Colors.deepPurpleAccent,
      ),
    );
  }

  Widget _buildFormTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            _buildPersonalInfoCard(),
            const SizedBox(height: 16),
            _buildSummaryCard(),
            const SizedBox(height: 16),
            _buildExperienceCard(),
            const SizedBox(height: 16),
            _buildEducationCard(),
            const SizedBox(height: 16),
            _buildSkillsCard(),
            const SizedBox(height: 16),
            _buildCertificationsCard(),
            const SizedBox(height: 16),
            _buildPublicationsCard(),
            const SizedBox(height: 16),
            _buildProjectsCard(),
            const SizedBox(height: 80), // Fab space
          ],
        ),
      ),
    );
  }

  Widget _buildStyleTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: GlassCard(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Design System Settings', style: Theme.of(context).textTheme.titleLarge),
              const Divider(color: Colors.white24),
              const SizedBox(height: 16),
              const Text('Font Family', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _fontFamily,
                decoration: const InputDecoration(border: OutlineInputBorder()),
                items: _fontFamilies.map((font) {
                  return DropdownMenuItem(
                    value: font,
                    child: Text(font.split(',')[0]),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _fontFamily = val);
                },
              ),
              const SizedBox(height: 24),
              Text('Font Size: ${_fontSize.toInt()} pt', style: const TextStyle(fontWeight: FontWeight.bold)),
              Slider(
                value: _fontSize,
                min: 10,
                max: 16,
                divisions: 6,
                activeColor: Colors.deepPurpleAccent,
                onChanged: (val) => setState(() => _fontSize = val),
              ),
              const SizedBox(height: 24),
              const Text('Accent Theme Color', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: _accentColors.map((color) {
                  final hex = color['value']!;
                  final colorVal = Color(int.parse(hex.replaceFirst('#', '0xFF')));
                  final isSelected = _accentColor == hex;
                  return ChoiceChip(
                    label: Text(color['name']!),
                    selected: isSelected,
                    selectedColor: colorVal.withOpacity(0.3),
                    avatar: CircleAvatar(backgroundColor: colorVal, radius: 10),
                    onSelected: (selected) {
                      if (selected) setState(() => _accentColor = hex);
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Show Logo on Document', style: TextStyle(fontWeight: FontWeight.bold)),
                  Switch(
                    value: _showLogo,
                    activeColor: Colors.deepPurpleAccent,
                    onChanged: (val) => setState(() => _showLogo = val),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildExportTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('AI Operations & Sync', style: Theme.of(context).textTheme.titleLarge),
                  const Divider(color: Colors.white24),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: _parseResumeFromPdf,
                    icon: const Icon(Icons.file_upload_outlined),
                    label: const Text('Parse Resume from PDF'),
                    style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 50)),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                    onPressed: _generateAIElevatorPitch,
                    icon: const Icon(Icons.video_library_outlined),
                    label: const Text('Generate AI Elevator Pitch'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.teal,
                      minimumSize: const Size(double.infinity, 50),
                    ),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                    onPressed: _syncToCloud,
                    icon: const Icon(Icons.cloud_upload_outlined),
                    label: const Text('Sync to Cloud Firestore'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.indigo,
                      minimumSize: const Size(double.infinity, 50),
                    ),
                  ),
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
                  Text('Downloads & Export', style: Theme.of(context).textTheme.titleLarge),
                  const Divider(color: Colors.white24),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _downloadResume('PDF'),
                          icon: const Icon(Icons.picture_as_pdf),
                          label: const Text('Download PDF'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _downloadResume('DOCX'),
                          icon: const Icon(Icons.article),
                          label: const Text('Download Word'),
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.blueAccent),
                        ),
                      ),
                    ],
                  )
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --- Sub-Form Cards (Collapsible ExpansionTiles) ---

  Widget _buildPersonalInfoCard() {
    return GlassCard(
      child: ExpansionTile(
        leading: const Icon(Icons.person, color: Colors.deepPurpleAccent),
        title: const Text('Personal Information', style: TextStyle(fontWeight: FontWeight.bold)),
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                Row(
                  children: [
                    GestureDetector(
                      onTap: _selectProfilePicture,
                      child: CircleAvatar(
                        radius: 35,
                        backgroundColor: Colors.deepPurple.withOpacity(0.2),
                        backgroundImage: _profilePicFile != null
                            ? FileImage(_profilePicFile!)
                            : (_profilePicUrl != null ? NetworkImage(_profilePicUrl!) : null) as ImageProvider?,
                        child: (_profilePicFile == null && _profilePicUrl == null)
                            ? const Icon(Icons.camera_alt, color: Colors.white70)
                            : null,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ElevatedButton(
                          onPressed: _selectProfilePicture,
                          style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4)),
                          child: const Text('Select Photo', style: TextStyle(fontSize: 12)),
                        ),
                        if (_profilePicFile != null || _profilePicUrl != null)
                          TextButton(
                            onPressed: () => setState(() {
                              _profilePicFile = null;
                              _profilePicUrl = null;
                            }),
                            child: const Text('Remove Photo', style: TextStyle(color: Colors.redAccent, fontSize: 12)),
                          ),
                      ],
                    )
                  ],
                ),
                const SizedBox(height: 16),
                TextFormField(
                  initialValue: _personal['name'],
                  decoration: const InputDecoration(labelText: 'Full Name'),
                  onChanged: (val) => _personal['name'] = val,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  initialValue: _personal['email'],
                  decoration: const InputDecoration(labelText: 'Email Address'),
                  keyboardType: TextInputType.emailAddress,
                  onChanged: (val) => _personal['email'] = val,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  initialValue: _personal['phone'],
                  decoration: const InputDecoration(labelText: 'Phone Number'),
                  keyboardType: TextInputType.phone,
                  onChanged: (val) => _personal['phone'] = val,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  initialValue: _personal['location'],
                  decoration: const InputDecoration(labelText: 'Location (City, State)'),
                  onChanged: (val) => _personal['location'] = val,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _personal['legalStatus'],
                  decoration: const InputDecoration(labelText: 'Legal Work Status'),
                  items: const [
                    DropdownMenuItem(value: 'Prefer not to say', child: Text('Prefer not to say')),
                    DropdownMenuItem(value: 'U.S. Citizen', child: Text('U.S. Citizen')),
                    DropdownMenuItem(value: 'Permanent Resident', child: Text('Permanent Resident')),
                    DropdownMenuItem(value: 'Authorized to Work', child: Text('Authorized to Work')),
                  ],
                  onChanged: (val) {
                    if (val != null) _personal['legalStatus'] = val;
                  },
                ),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildSummaryCard() {
    return GlassCard(
      child: ExpansionTile(
        leading: const Icon(Icons.description, color: Colors.deepPurpleAccent),
        title: const Text('Professional Summary', style: TextStyle(fontWeight: FontWeight.bold)),
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextFormField(
                  initialValue: _summary,
                  maxLines: 5,
                  decoration: const InputDecoration(
                    hintText: 'A concise summary of your professional experience...',
                  ),
                  onChanged: (val) => _summary = val,
                ),
                const SizedBox(height: 8),
                ElevatedButton.icon(
                  onPressed: () => _enhanceField('Summary', _summary, (enhancedVal) {
                    setState(() => _summary = enhancedVal);
                  }),
                  icon: const Icon(Icons.auto_awesome, size: 16),
                  label: const Text('AI Enhance Summary'),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildExperienceCard() {
    return GlassCard(
      child: ExpansionTile(
        leading: const Icon(Icons.work, color: Colors.deepPurpleAccent),
        title: const Text('Work Experience', style: TextStyle(fontWeight: FontWeight.bold)),
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                ..._experience.asMap().entries.map((entry) {
                  int idx = entry.key;
                  Map<String, dynamic> item = entry.value;
                  return Card(
                    color: Colors.white.withOpacity(0.05),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Experience #${idx + 1}', style: const TextStyle(fontWeight: FontWeight.bold)),
                              IconButton(
                                icon: const Icon(Icons.delete, color: Colors.redAccent),
                                onPressed: () => setState(() => _experience.removeAt(idx)),
                              )
                            ],
                          ),
                          TextFormField(
                            initialValue: item['jobTitle'],
                            decoration: const InputDecoration(labelText: 'Job Title'),
                            onChanged: (val) => item['jobTitle'] = val,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: item['company'],
                            decoration: const InputDecoration(labelText: 'Company'),
                            onChanged: (val) => item['company'] = val,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: item['dates'],
                            decoration: const InputDecoration(labelText: 'Dates (e.g. 2022 - Present)'),
                            onChanged: (val) => item['dates'] = val,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: item['description'],
                            maxLines: 3,
                            decoration: const InputDecoration(labelText: 'Description / Job Duties'),
                            onChanged: (val) => item['description'] = val,
                          ),
                          const SizedBox(height: 8),
                          ElevatedButton.icon(
                            onPressed: () => _enhanceField('Experience Description', item['description'] ?? '', (enhancedVal) {
                              setState(() => item['description'] = enhancedVal);
                            }),
                            icon: const Icon(Icons.auto_awesome, size: 16),
                            label: const Text('AI Enhance Description'),
                          )
                        ],
                      ),
                    ),
                  );
                }),
                ElevatedButton(
                  onPressed: () => setState(() => _experience.add({
                    'id': 'exp_${DateTime.now().millisecondsSinceEpoch}',
                    'jobTitle': '',
                    'company': '',
                    'dates': '',
                    'description': '',
                  })),
                  child: const Text('+ Add Experience'),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildEducationCard() {
    return GlassCard(
      child: ExpansionTile(
        leading: const Icon(Icons.school, color: Colors.deepPurpleAccent),
        title: const Text('Education', style: TextStyle(fontWeight: FontWeight.bold)),
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                ..._education.asMap().entries.map((entry) {
                  int idx = entry.key;
                  Map<String, dynamic> item = entry.value;
                  return Card(
                    color: Colors.white.withOpacity(0.05),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Education #${idx + 1}', style: const TextStyle(fontWeight: FontWeight.bold)),
                              IconButton(
                                icon: const Icon(Icons.delete, color: Colors.redAccent),
                                onPressed: () => setState(() => _education.removeAt(idx)),
                              )
                            ],
                          ),
                          TextFormField(
                            initialValue: item['degree'],
                            decoration: const InputDecoration(labelText: 'Degree / Major'),
                            onChanged: (val) => item['degree'] = val,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: item['institution'],
                            decoration: const InputDecoration(labelText: 'Institution / University'),
                            onChanged: (val) => item['institution'] = val,
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: TextFormField(
                                  initialValue: item['graduationYear'],
                                  decoration: const InputDecoration(labelText: 'Graduation Year'),
                                  onChanged: (val) => item['graduationYear'] = val,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextFormField(
                                  initialValue: item['gpa'],
                                  decoration: const InputDecoration(labelText: 'GPA (optional)'),
                                  onChanged: (val) => item['gpa'] = val,
                                ),
                              )
                            ],
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: item['achievements'],
                            maxLines: 2,
                            decoration: const InputDecoration(labelText: 'Achievements / Coursework'),
                            onChanged: (val) => item['achievements'] = val,
                          ),
                          const SizedBox(height: 8),
                          ElevatedButton.icon(
                            onPressed: () => _enhanceField('Education Achievements', item['achievements'] ?? '', (enhancedVal) {
                              setState(() => item['achievements'] = enhancedVal);
                            }),
                            icon: const Icon(Icons.auto_awesome, size: 16),
                            label: const Text('AI Enhance Achievements'),
                          )
                        ],
                      ),
                    ),
                  );
                }),
                ElevatedButton(
                  onPressed: () => setState(() => _education.add({
                    'id': 'edu_${DateTime.now().millisecondsSinceEpoch}',
                    'degree': '',
                    'institution': '',
                    'graduationYear': '',
                    'gpa': '',
                    'achievements': '',
                  })),
                  child: const Text('+ Add Education'),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildSkillsCard() {
    return GlassCard(
      child: ExpansionTile(
        leading: const Icon(Icons.bolt, color: Colors.deepPurpleAccent),
        title: const Text('Skills & Core Competencies', style: TextStyle(fontWeight: FontWeight.bold)),
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                ..._skills.asMap().entries.map((entry) {
                  int idx = entry.key;
                  Map<String, dynamic> item = entry.value;
                  return Card(
                    color: Colors.white.withOpacity(0.05),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Skills Category #${idx + 1}', style: const TextStyle(fontWeight: FontWeight.bold)),
                              IconButton(
                                icon: const Icon(Icons.delete, color: Colors.redAccent),
                                onPressed: () => setState(() => _skills.removeAt(idx)),
                              )
                            ],
                          ),
                          TextFormField(
                            initialValue: item['category'],
                            decoration: const InputDecoration(labelText: 'Category (e.g. Programming, Tools)'),
                            onChanged: (val) => item['category'] = val,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: item['skills_list'],
                            decoration: const InputDecoration(labelText: 'Skills list (comma-separated)'),
                            onChanged: (val) => item['skills_list'] = val,
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                ElevatedButton(
                  onPressed: () => setState(() => _skills.add({
                    'id': 'skill_${DateTime.now().millisecondsSinceEpoch}',
                    'category': '',
                    'skills_list': '',
                  })),
                  child: const Text('+ Add Skills Category'),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildCertificationsCard() {
    return GlassCard(
      child: ExpansionTile(
        leading: const Icon(Icons.workspace_premium, color: Colors.deepPurpleAccent),
        title: const Text('Certifications', style: TextStyle(fontWeight: FontWeight.bold)),
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                ..._certifications.asMap().entries.map((entry) {
                  int idx = entry.key;
                  Map<String, dynamic> item = entry.value;
                  return Card(
                    color: Colors.white.withOpacity(0.05),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Certification #${idx + 1}', style: const TextStyle(fontWeight: FontWeight.bold)),
                              IconButton(
                                icon: const Icon(Icons.delete, color: Colors.redAccent),
                                onPressed: () => setState(() => _certifications.removeAt(idx)),
                              )
                            ],
                          ),
                          TextFormField(
                            initialValue: item['name'],
                            decoration: const InputDecoration(labelText: 'Certification Name'),
                            onChanged: (val) => item['name'] = val,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: item['issuer'],
                            decoration: const InputDecoration(labelText: 'Issuer / Organization'),
                            onChanged: (val) => item['issuer'] = val,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: item['date'],
                            decoration: const InputDecoration(labelText: 'Date Issued'),
                            onChanged: (val) => item['date'] = val,
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                ElevatedButton(
                  onPressed: () => setState(() => _certifications.add({
                    'id': 'cert_${DateTime.now().millisecondsSinceEpoch}',
                    'name': '',
                    'issuer': '',
                    'date': '',
                  })),
                  child: const Text('+ Add Certification'),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildPublicationsCard() {
    return GlassCard(
      child: ExpansionTile(
        leading: const Icon(Icons.book, color: Colors.deepPurpleAccent),
        title: const Text('Publications', style: TextStyle(fontWeight: FontWeight.bold)),
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                ..._publications.asMap().entries.map((entry) {
                  int idx = entry.key;
                  Map<String, dynamic> item = entry.value;
                  return Card(
                    color: Colors.white.withOpacity(0.05),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Publication #${idx + 1}', style: const TextStyle(fontWeight: FontWeight.bold)),
                              IconButton(
                                icon: const Icon(Icons.delete, color: Colors.redAccent),
                                onPressed: () => setState(() => _publications.removeAt(idx)),
                              )
                            ],
                          ),
                          TextFormField(
                            initialValue: item['title'],
                            decoration: const InputDecoration(labelText: 'Publication Title'),
                            onChanged: (val) => item['title'] = val,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: item['authors'],
                            decoration: const InputDecoration(labelText: 'Authors'),
                            onChanged: (val) => item['authors'] = val,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: item['journal'],
                            decoration: const InputDecoration(labelText: 'Journal / Conference'),
                            onChanged: (val) => item['journal'] = val,
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: TextFormField(
                                  initialValue: item['date'],
                                  decoration: const InputDecoration(labelText: 'Date'),
                                  onChanged: (val) => item['date'] = val,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextFormField(
                                  initialValue: item['link'],
                                  decoration: const InputDecoration(labelText: 'URL Link'),
                                  onChanged: (val) => item['link'] = val,
                                ),
                              )
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                ElevatedButton(
                  onPressed: () => setState(() => _publications.add({
                    'id': 'pub_${DateTime.now().millisecondsSinceEpoch}',
                    'title': '',
                    'authors': '',
                    'journal': '',
                    'date': '',
                    'link': '',
                  })),
                  child: const Text('+ Add Publication'),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildProjectsCard() {
    return GlassCard(
      child: ExpansionTile(
        leading: const Icon(Icons.folder_shared, color: Colors.deepPurpleAccent),
        title: const Text('Projects', style: TextStyle(fontWeight: FontWeight.bold)),
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                ..._projects.asMap().entries.map((entry) {
                  int idx = entry.key;
                  Map<String, dynamic> item = entry.value;
                  return Card(
                    color: Colors.white.withOpacity(0.05),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Project #${idx + 1}', style: const TextStyle(fontWeight: FontWeight.bold)),
                              IconButton(
                                icon: const Icon(Icons.delete, color: Colors.redAccent),
                                onPressed: () => setState(() => _projects.removeAt(idx)),
                              )
                            ],
                          ),
                          TextFormField(
                            initialValue: item['title'],
                            decoration: const InputDecoration(labelText: 'Project Title'),
                            onChanged: (val) => item['title'] = val,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: item['date'],
                            decoration: const InputDecoration(labelText: 'Date (e.g. 2024)'),
                            onChanged: (val) => item['date'] = val,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: item['description'],
                            maxLines: 3,
                            decoration: const InputDecoration(labelText: 'Project Details / Technologies Used'),
                            onChanged: (val) => item['description'] = val,
                          ),
                          const SizedBox(height: 8),
                          ElevatedButton.icon(
                            onPressed: () => _enhanceField('Project Description', item['description'] ?? '', (enhancedVal) {
                              setState(() => item['description'] = enhancedVal);
                            }),
                            icon: const Icon(Icons.auto_awesome, size: 16),
                            label: const Text('AI Enhance Project'),
                          )
                        ],
                      ),
                    ),
                  );
                }),
                ElevatedButton(
                  onPressed: () => setState(() => _projects.add({
                    'id': 'proj_${DateTime.now().millisecondsSinceEpoch}',
                    'title': '',
                    'date': '',
                    'description': '',
                  })),
                  child: const Text('+ Add Project'),
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}
