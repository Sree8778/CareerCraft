import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:recruit_edge/pages/recruiter_job_post_page.dart';

class RecruiterRequisitionsPage extends StatefulWidget {
  const RecruiterRequisitionsPage({super.key});

  @override
  State<RecruiterRequisitionsPage> createState() => _RecruiterRequisitionsPageState();
}

class _RecruiterRequisitionsPageState extends State<RecruiterRequisitionsPage> {
  List<Map<String, dynamic>> _jobs = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadJobs();
  }

  Future<void> _loadJobs() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        setState(() {
          _isLoading = false;
          _error = 'Not logged in.';
        });
        return;
      }
      final jobs = await fetchRecruiterJobs(user.uid);
      if (mounted) {
        setState(() {
          _jobs = jobs;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = 'Failed to load jobs. Pull to refresh.';
        });
      }
    }
  }

  Future<void> _openCreateJob() async {
    await Navigator.push(context, MaterialPageRoute(builder: (_) => const RecruiterJobPostPage()));
    // Refresh after returning in case a new job was posted
    _loadJobs();
  }

  void _showJobDetail(Map<String, dynamic> job) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF0F0C20) : Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.6,
          minChildSize: 0.4,
          maxChildSize: 0.9,
          expand: false,
          builder: (context, scrollCtrl) {
            final status = job['status'] ?? 'Open';
            final statusColor = _statusColor(status);
            return SingleChildScrollView(
              controller: scrollCtrl,
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 50, height: 5,
                      decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          job['title'] ?? 'Untitled',
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: statusColor.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: statusColor.withOpacity(0.4)),
                        ),
                        child: Text(status, style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if ((job['company'] ?? '').isNotEmpty)
                    Text(job['company'], style: const TextStyle(color: Colors.deepPurpleAccent, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 4),
                  _metaRow(Icons.location_on_outlined, job['location'] ?? 'Location not set', isDark),
                  _metaRow(Icons.work_outline, job['jobType'] ?? '', isDark),
                  _metaRow(Icons.laptop_mac_outlined, job['workMode'] ?? '', isDark),
                  if ((job['salaryRange'] ?? job['salary'] ?? '').isNotEmpty)
                    _metaRow(Icons.attach_money, job['salaryRange'] ?? job['salary'] ?? '', isDark),
                  const SizedBox(height: 16),
                  const Divider(color: Colors.white12),
                  const SizedBox(height: 12),
                  if ((job['description'] ?? '').isNotEmpty) ...[
                    Text(
                      'Description',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: isDark ? Colors.white : Colors.black87),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      job['description'],
                      style: TextStyle(fontSize: 13, color: isDark ? Colors.white60 : Colors.black54, height: 1.5),
                    ),
                  ],
                  const SizedBox(height: 24),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'open': return Colors.green;
      case 'paused': return Colors.orange;
      case 'closed': return Colors.red;
      case 'draft': return Colors.blueGrey;
      default: return Colors.grey;
    }
  }

  Widget _metaRow(IconData icon, String text, bool isDark) {
    if (text.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Icon(icon, size: 14, color: Colors.grey),
          const SizedBox(width: 6),
          Text(text, style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : Colors.black45)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: const Text('My Requisitions', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline, color: Colors.deepPurpleAccent),
            tooltip: 'Post New Job',
            onPressed: _openCreateJob,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
          : RefreshIndicator(
              onRefresh: _loadJobs,
              child: _error != null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.error_outline, size: 48, color: Colors.grey),
                            const SizedBox(height: 12),
                            Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
                          ],
                        ),
                      ),
                    )
                  : _jobs.isEmpty
                      ? ListView(
                          children: [
                            const SizedBox(height: 80),
                            const Icon(Icons.work_off_outlined, size: 56, color: Colors.grey),
                            const SizedBox(height: 16),
                            const Text(
                              'No requisitions yet.\nPost your first job to get started.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.grey, fontSize: 14, height: 1.5),
                            ),
                            const SizedBox(height: 24),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 48),
                              child: ElevatedButton.icon(
                                onPressed: _openCreateJob,
                                icon: const Icon(Icons.add),
                                label: const Text('Post a Job'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.deepPurpleAccent,
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                              ),
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                          itemCount: _jobs.length + 1,
                          itemBuilder: (context, idx) {
                            if (idx == _jobs.length) {
                              return Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: OutlinedButton.icon(
                                  onPressed: _openCreateJob,
                                  icon: const Icon(Icons.add, color: Colors.deepPurpleAccent),
                                  label: const Text('Post New Job', style: TextStyle(color: Colors.deepPurpleAccent, fontWeight: FontWeight.bold)),
                                  style: OutlinedButton.styleFrom(
                                    side: const BorderSide(color: Colors.deepPurpleAccent),
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  ),
                                ),
                              );
                            }
                            final job = _jobs[idx];
                            final status = job['status'] ?? 'Open';
                            final statusColor = _statusColor(status);
                            return GlassCard(
                              margin: const EdgeInsets.only(bottom: 12),
                              onTap: () => _showJobDetail(job),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            job['title'] ?? 'Untitled',
                                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: textColor),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: statusColor.withOpacity(0.12),
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(color: statusColor.withOpacity(0.35)),
                                          ),
                                          child: Text(status, style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold)),
                                        ),
                                      ],
                                    ),
                                    if ((job['company'] ?? '').isNotEmpty) ...[
                                      const SizedBox(height: 4),
                                      Text(job['company'], style: const TextStyle(color: Colors.deepPurpleAccent, fontSize: 12, fontWeight: FontWeight.w500)),
                                    ],
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        if ((job['location'] ?? '').isNotEmpty)
                                          _chip(Icons.location_on_outlined, job['location'], isDark),
                                        if ((job['workMode'] ?? '').isNotEmpty)
                                          _chip(Icons.laptop_mac_outlined, job['workMode'], isDark),
                                        if ((job['jobType'] ?? '').isNotEmpty)
                                          _chip(Icons.access_time_outlined, job['jobType'], isDark),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
            ),
    );
  }

  Widget _chip(IconData icon, String label, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(right: 6, top: 2),
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withOpacity(0.06) : Colors.black.withOpacity(0.05),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: Colors.grey),
          const SizedBox(width: 3),
          Text(label, style: const TextStyle(color: Colors.grey, fontSize: 11)),
        ],
      ),
    );
  }
}
