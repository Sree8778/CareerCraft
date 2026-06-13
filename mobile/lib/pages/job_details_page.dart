import 'package:flutter/material.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:firebase_auth/firebase_auth.dart';

class JobDetailsPage extends StatefulWidget {
  final Map<String, dynamic> job;

  const JobDetailsPage({super.key, required this.job});

  @override
  State<JobDetailsPage> createState() => _JobDetailsPageState();
}

class _JobDetailsPageState extends State<JobDetailsPage> {
  final TextEditingController _coverLetterController = TextEditingController();
  bool _isLoading = true;
  bool _isSubmitting = false;
  Map<String, dynamic>? _existingApplication;

  @override
  void initState() {
    super.initState();
    _checkExistingApplication();
  }

  Future<void> _checkExistingApplication() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      setState(() {
        _isLoading = false;
      });
      return;
    }

    try {
      final apps = await fetchApplications(user.uid);
      final found = apps.firstWhere(
        (a) => a['jobId'] == widget.job['id'],
        orElse: () => null,
      );
      if (mounted) {
        setState(() {
          _existingApplication = found;
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Error checking existing app: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _submitApplication() async {
    setState(() {
      _isSubmitting = true;
    });

    try {
      final success = await applyToJob(
        widget.job['id'],
        _coverLetterController.text,
      );

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Application submitted successfully!')),
        );
        _coverLetterController.clear();
        _checkExistingApplication();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to submit application. you might have already applied.')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _coverLetterController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final job = widget.job;

    return Scaffold(
      backgroundColor: isDarkMode ? const Color(0xFF0F0C20) : Colors.white,
      appBar: AppBar(
        title: Text(job['title'] ?? 'Job Details', style: const TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: isDarkMode ? Colors.white : Colors.black),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
          : SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Job Header GlassCard
                    GlassCard(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              job['title'] ?? '',
                              style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87, fontSize: 20, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '${job['company'] ?? 'CareerCraft Client'} • ${job['location'] ?? 'Remote'}',
                              style: TextStyle(color: isDarkMode ? Colors.white60 : Colors.black54, fontSize: 14),
                            ),
                            const SizedBox(height: 12),
                            if (job['salary'] != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF10B981).withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3)),
                                ),
                                child: Text(
                                  job['salary'],
                                  style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 12),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Job Description
                    Text(
                      'Job Description',
                      style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87, fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      job['description'] ?? 'No description listed.',
                      style: TextStyle(color: isDarkMode ? Colors.white70 : Colors.black87, fontSize: 13, height: 1.5),
                    ),
                    const SizedBox(height: 24),

                    // Applied Dashboard OR Apply forms
                    Text(
                      'Application Panel',
                      style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87, fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 12),
                    
                    if (_existingApplication != null) ...[
                      // Dynamic Stage Card
                      GlassCard(
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.check_circle, color: Colors.green, size: 24),
                                  const SizedBox(width: 8),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text('Application Status', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                      Text(
                                        'Applied on ${_existingApplication!['appliedDate'] ?? 'a recent date'}',
                                        style: const TextStyle(color: Colors.grey, fontSize: 11),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              
                              // Pipeline Stage Badge
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.deepPurpleAccent.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: Colors.deepPurpleAccent.withOpacity(0.3)),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Pipeline stage:', style: TextStyle(fontSize: 12)),
                                    Text(
                                      (_existingApplication!['status'] ?? 'Applied').toUpperCase(),
                                      style: TextStyle(color: Colors.deepPurpleAccent, fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 1.1),
                                    ),
                                  ],
                                ),
                              ),
                              
                              // Recruiter feedback notes
                              if (_existingApplication!['recruiterNotes'] != null && _existingApplication!['recruiterNotes'].toString().isNotEmpty) ...[
                                const SizedBox(height: 16),
                                const Text('Recruiter Feedback Notes', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Colors.purpleAccent)),
                                const SizedBox(height: 6),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.02),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: Colors.white12),
                                  ),
                                  child: Text(
                                    '"${_existingApplication!['recruiterNotes']}"',
                                    style: const TextStyle(color: Colors.white70, fontSize: 12, fontStyle: FontStyle.italic),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ] else ...[
                      // Manual application form
                      GlassCard(
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Text('Apply traditionally', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                              const SizedBox(height: 6),
                              const Text('Provide a cover letter draft for the recruiter to review.', style: TextStyle(color: Colors.grey, fontSize: 11)),
                              const SizedBox(height: 16),
                              
                              TextField(
                                controller: _coverLetterController,
                                style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87),
                                maxLines: 5,
                                decoration: InputDecoration(
                                  labelText: 'Cover Letter (Optional)',
                                  labelStyle: TextStyle(color: isDarkMode ? darkMutedTextColor : mutedTextColor),
                                  hintText: 'Tell us why you are a great fit for this role...',
                                  hintStyle: TextStyle(color: isDarkMode ? Colors.white38 : Colors.black38),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                                  filled: true,
                                  fillColor: isDarkMode ? Colors.black.withOpacity(0.2) : Colors.grey.withOpacity(0.05),
                                ),
                              ),
                              const SizedBox(height: 16),
                              
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.deepPurpleAccent,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                ),
                                onPressed: _isSubmitting ? null : _submitApplication,
                                child: _isSubmitting
                                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                    : const Text('Submit Application', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
    );
  }
}
