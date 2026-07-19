import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:recruit_edge/pages/candidate_resume_builder_page.dart';

class CandidateProfilePage extends StatefulWidget {
  const CandidateProfilePage({super.key});

  @override
  State<CandidateProfilePage> createState() => _CandidateProfilePageState();
}

class _CandidateProfilePageState extends State<CandidateProfilePage> {
  Map<String, dynamic>? _profile;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() => _isLoading = true);
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        setState(() => _isLoading = false);
        return;
      }
      final doc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
      final data = doc.data() ?? {};
      if (mounted) {
        setState(() {
          _profile = {
            'name': data['name'] ?? user.displayName ?? '',
            'email': data['email'] ?? user.email ?? '',
            'phone': data['phone'] ?? '',
            'headline': data['headline'] ?? '',
            'bio': data['bio'] ?? '',
            'skills': data['skills'] ?? '',
            'location': data['location'] ?? '',
          };
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading profile: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _showEditSheet() async {
    if (_profile == null) return;

    final nameCtrl = TextEditingController(text: _profile!['name']);
    final phoneCtrl = TextEditingController(text: _profile!['phone']);
    final headlineCtrl = TextEditingController(text: _profile!['headline']);
    final bioCtrl = TextEditingController(text: _profile!['bio']);
    final skillsCtrl = TextEditingController(text: _profile!['skills']);
    final locationCtrl = TextEditingController(text: _profile!['location']);

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F0C20),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _EditProfileSheet(
        nameCtrl: nameCtrl,
        phoneCtrl: phoneCtrl,
        headlineCtrl: headlineCtrl,
        bioCtrl: bioCtrl,
        skillsCtrl: skillsCtrl,
        locationCtrl: locationCtrl,
        onSaved: (updates) {
          setState(() => _profile = {..._profile!, ...updates});
        },
      ),
    );

    nameCtrl.dispose();
    phoneCtrl.dispose();
    headlineCtrl.dispose();
    bioCtrl.dispose();
    skillsCtrl.dispose();
    locationCtrl.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final user = FirebaseAuth.instance.currentUser;
    final textColor = isDark ? Colors.white : Colors.black87;
    final mutedColor = isDark ? Colors.white54 : Colors.black45;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: const Text('My Profile', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          if (!_isLoading && _profile != null)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Edit Profile',
              onPressed: _showEditSheet,
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
          : RefreshIndicator(
              onRefresh: _loadProfile,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Identity card
                    GlassCard(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            CircleAvatar(
                              radius: 34,
                              backgroundColor: Colors.deepPurpleAccent.withOpacity(0.2),
                              backgroundImage: user?.photoURL != null ? NetworkImage(user!.photoURL!) : null,
                              child: user?.photoURL == null
                                  ? Text(
                                      _initials(_profile?['name'] ?? user?.displayName ?? '?'),
                                      style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: Colors.deepPurpleAccent),
                                    )
                                  : null,
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _profile?['name'].isNotEmpty == true
                                        ? _profile!['name']
                                        : (user?.displayName ?? 'No name set'),
                                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: textColor),
                                  ),
                                  if ((_profile?['headline'] ?? '').isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      _profile!['headline'],
                                      style: const TextStyle(color: Colors.deepPurpleAccent, fontSize: 13, fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                  if ((_profile?['location'] ?? '').isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        const Icon(Icons.location_on_outlined, size: 13, color: Colors.grey),
                                        const SizedBox(width: 4),
                                        Text(_profile!['location'], style: const TextStyle(color: Colors.grey, fontSize: 12)),
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Contact
                    GlassCard(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Contact', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: textColor)),
                            const SizedBox(height: 12),
                            _infoRow(Icons.email_outlined, _profile?['email'] ?? user?.email ?? '', mutedColor),
                            if ((_profile?['phone'] ?? '').isNotEmpty)
                              _infoRow(Icons.phone_outlined, _profile!['phone'], mutedColor),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Bio
                    if ((_profile?['bio'] ?? '').isNotEmpty) ...[
                      GlassCard(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('About', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: textColor)),
                              const SizedBox(height: 8),
                              Text(
                                _profile!['bio'],
                                style: TextStyle(fontSize: 13, color: mutedColor, height: 1.5),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Skills
                    if ((_profile?['skills'] ?? '').isNotEmpty) ...[
                      GlassCard(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Skills', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: textColor)),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: (_profile!['skills'] as String)
                                    .split(',')
                                    .map((s) => s.trim())
                                    .where((s) => s.isNotEmpty)
                                    .map((skill) => Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                          decoration: BoxDecoration(
                                            color: Colors.deepPurpleAccent.withOpacity(0.12),
                                            borderRadius: BorderRadius.circular(20),
                                            border: Border.all(color: Colors.deepPurpleAccent.withOpacity(0.3)),
                                          ),
                                          child: Text(skill, style: const TextStyle(color: Colors.deepPurpleAccent, fontSize: 12, fontWeight: FontWeight.w500)),
                                        ))
                                    .toList(),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Resume Builder
                    GlassCard(
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CandidateResumeBuilderPage())),
                      child: ListTile(
                        leading: const Icon(Icons.description_outlined, color: Colors.deepPurpleAccent),
                        title: Text('Resume Builder', style: TextStyle(fontWeight: FontWeight.bold, color: textColor)),
                        subtitle: Text('Create, edit and export your resume with AI', style: TextStyle(color: mutedColor, fontSize: 12)),
                        trailing: const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.grey),
                      ),
                    ),
                    const SizedBox(height: 20),

                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: OutlinedButton.icon(
                        onPressed: _showEditSheet,
                        icon: const Icon(Icons.edit_outlined, color: Colors.deepPurpleAccent),
                        label: const Text('Edit Profile', style: TextStyle(color: Colors.deepPurpleAccent, fontWeight: FontWeight.bold)),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Colors.deepPurpleAccent),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  Widget _infoRow(IconData icon, String text, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: Colors.grey),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: color))),
        ],
      ),
    );
  }
}

// ── Edit profile bottom sheet ─────────────────────────────────────────────────

class _EditProfileSheet extends StatefulWidget {
  final TextEditingController nameCtrl;
  final TextEditingController phoneCtrl;
  final TextEditingController headlineCtrl;
  final TextEditingController bioCtrl;
  final TextEditingController skillsCtrl;
  final TextEditingController locationCtrl;
  final void Function(Map<String, dynamic> updates) onSaved;

  const _EditProfileSheet({
    required this.nameCtrl,
    required this.phoneCtrl,
    required this.headlineCtrl,
    required this.bioCtrl,
    required this.skillsCtrl,
    required this.locationCtrl,
    required this.onSaved,
  });

  @override
  State<_EditProfileSheet> createState() => _EditProfileSheetState();
}

class _EditProfileSheetState extends State<_EditProfileSheet> {
  bool _isSaving = false;

  Future<void> _save() async {
    setState(() => _isSaving = true);
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;
      final updates = {
        'name': widget.nameCtrl.text.trim(),
        'phone': widget.phoneCtrl.text.trim(),
        'headline': widget.headlineCtrl.text.trim(),
        'bio': widget.bioCtrl.text.trim(),
        'skills': widget.skillsCtrl.text.trim(),
        'location': widget.locationCtrl.text.trim(),
      };
      await FirebaseFirestore.instance.collection('users').doc(user.uid).set(updates, SetOptions(merge: true));
      if (widget.nameCtrl.text.trim().isNotEmpty) {
        await user.updateDisplayName(widget.nameCtrl.text.trim());
      }
      widget.onSaved(updates);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(backgroundColor: Colors.green, content: Text('Profile updated successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: Colors.red, content: Text('Failed to save: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return SingleChildScrollView(
          controller: scrollController,
          padding: EdgeInsets.only(
            left: 24, right: 24, top: 24,
            bottom: MediaQuery.of(context).viewInsets.bottom + 24,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 50, height: 5,
                  decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 20),
              const Text('Edit Profile', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 20),
              _field(widget.nameCtrl, 'Full Name', Icons.person_outline),
              const SizedBox(height: 12),
              _field(widget.phoneCtrl, 'Phone Number', Icons.phone_outlined, keyboard: TextInputType.phone),
              const SizedBox(height: 12),
              _field(widget.headlineCtrl, 'Headline', Icons.title_outlined),
              const SizedBox(height: 12),
              _field(widget.locationCtrl, 'Location', Icons.location_on_outlined),
              const SizedBox(height: 12),
              _field(widget.skillsCtrl, 'Skills (comma-separated)', Icons.code_outlined),
              const SizedBox(height: 12),
              TextField(
                controller: widget.bioCtrl,
                maxLines: 4,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: _inputDeco('Bio', Icons.info_outline),
              ),
              const SizedBox(height: 24),
              SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: _isSaving ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.deepPurpleAccent,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isSaving
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Save Changes', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _field(TextEditingController ctrl, String label, IconData icon, {TextInputType? keyboard}) {
    return TextField(
      controller: ctrl,
      keyboardType: keyboard,
      style: const TextStyle(color: Colors.white, fontSize: 13),
      decoration: _inputDeco(label, icon),
    );
  }

  InputDecoration _inputDeco(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Colors.white54),
      prefixIcon: Icon(icon, color: Colors.white38, size: 20),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Colors.white12)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Colors.white12)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Colors.deepPurpleAccent)),
    );
  }
}
