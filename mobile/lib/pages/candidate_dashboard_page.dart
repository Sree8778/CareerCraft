import 'package:flutter/material.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:recruit_edge/pages/candidate_profile_page.dart';
import 'package:recruit_edge/pages/candidate_applications_page.dart';
import 'package:recruit_edge/pages/job_search_page.dart';
import 'package:recruit_edge/pages/candidate_resume_builder_page.dart';
import 'package:recruit_edge/pages/candidate_interview_page.dart';
import 'package:recruit_edge/pages/candidate_messages_page.dart';
import 'package:recruit_edge/pages/job_details_page.dart';
import 'package:recruit_edge/pages/companies_page.dart';
import 'package:recruit_edge/pages/candidate_smart_apply_page.dart';
import 'dart:async';

class CandidateDashboardPage extends StatefulWidget {
  const CandidateDashboardPage({super.key});

  @override
  State<CandidateDashboardPage> createState() => _CandidateDashboardPageState();
}

class _CandidateDashboardPageState extends State<CandidateDashboardPage> {
  List<dynamic> _notifications = [];
  bool _isLoadingNotifs = true;
  Timer? _notifTimer;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
    _notifTimer = Timer.periodic(const Duration(seconds: 8), (_) => _loadNotifications(silent: true));
  }

  Future<void> _loadNotifications({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoadingNotifs = true;
      });
    }
    try {
      final fetched = await fetchNotifications();
      if (mounted) {
        setState(() {
          _notifications = fetched;
          _isLoadingNotifs = false;
        });
      }
    } catch (e) {
      print('Error loading notifications in dashboard: $e');
      if (mounted) {
        setState(() {
          _isLoadingNotifs = false;
        });
      }
    }
  }

  Future<void> _clearNotifications() async {
    setState(() {
      _isLoadingNotifs = true;
    });
    try {
      final success = await markNotificationsAsRead();
      if (success) {
        _loadNotifications(silent: true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.green,
            content: Text('All alerts marked as read!'),
          ),
        );
      } else {
        throw Exception('Failed to clear notifications');
      }
    } catch (e) {
      print('Error marking alerts as read: $e');
      _loadNotifications(silent: true);
    }
  }

  @override
  void dispose() {
    _notifTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Candidate Control Center',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold, fontSize: 24),
            ),
            const SizedBox(height: 20),
            
            // GRID-LIKE NAVIGATION ITEMS
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.person_outline, color: Colors.deepPurpleAccent),
                title: Text('My Profile', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold)),
                subtitle: Text('Manage your personal information, resume, and skills.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const CandidateProfilePage()),
                  );
                },
              ),
            ),
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.description_outlined, color: Colors.deepPurpleAccent),
                title: Text('Resume Builder', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold)),
                subtitle: Text('Create and edit your professional resume.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const CandidateResumeBuilderPage()),
                  );
                },
              ),
            ),
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.work_outline, color: Colors.deepPurpleAccent),
                title: Text('My Applications', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold)),
                subtitle: Text('View status of your job applications.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const CandidateApplicationsPage()),
                  );
                },
              ),
            ),
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.bolt, color: Colors.indigoAccent),
                title: Text('Smart Apply Autopilot', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold)),
                subtitle: Text('Manage autopilot job application queues and logs.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const CandidateSmartApplyPage()),
                  );
                },
              ),
            ),
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.interpreter_mode_outlined, color: Colors.deepPurpleAccent),
                title: Text('AI Voice Interview Arena', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold)),
                subtitle: Text('Complete your turn-based proctored AI voice assessment.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const CandidateInterviewPage()),
                  );
                },
              ),
            ),
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.forum_outlined, color: Colors.deepPurpleAccent),
                title: Text('Message Center', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold)),
                subtitle: Text('Chat in real-time with your hiring recruiters.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const CandidateMessagesPage()),
                  );
                },
              ),
            ),
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.search, color: Colors.deepPurpleAccent),
                title: Text('Job Search', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold)),
                subtitle: Text('Find new job opportunities with AI matches.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const JobSearchPage()),
                  );
                },
              ),
            ),
            GlassCard(
              child: ListTile(
                leading: const Icon(Icons.business_outlined, color: Colors.deepPurpleAccent),
                title: Text('Company Explorer', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold)),
                subtitle: Text('Research compensation curves and employee reviews.', style: Theme.of(context).textTheme.bodyMedium),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const CompaniesPage()),
                  );
                },
              ),
            ),
            
            const SizedBox(height: 28),
            
            // ACTIVE ALERTS CENTER
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Active Alerts Center',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold, fontSize: 18),
                ),
                if (_notifications.isNotEmpty)
                  TextButton.icon(
                    onPressed: _clearNotifications,
                    icon: const Icon(Icons.done_all, size: 16, color: Colors.tealAccent),
                    label: const Text('Mark all read', style: TextStyle(color: Colors.tealAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            
            _isLoadingNotifs
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(16.0),
                      child: CircularProgressIndicator(color: Colors.deepPurpleAccent),
                    ),
                  )
                : _notifications.isEmpty
                    ? const GlassCard(
                        child: Padding(
                          padding: EdgeInsets.all(16.0),
                          child: Row(
                            children: [
                              Icon(Icons.notifications_none, color: Colors.grey),
                              SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  'Your pipeline is quiet. Recruiters will trigger alerts as evaluations commence.',
                                  style: TextStyle(color: Colors.grey, fontSize: 12, height: 1.4),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    : Column(
                        children: _notifications.map((notif) {
                          final isUnread = notif['read'] == false;
                          return GlassCard(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                              child: Row(
                                children: [
                                  Container(
                                    width: 10,
                                    height: 10,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: isUnread ? Colors.deepPurpleAccent : Colors.transparent,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          notif['text'] ?? 'Alert text',
                                          style: TextStyle(
                                            color: isDarkMode ? Colors.white70 : Colors.black87,
                                            fontSize: 12,
                                            fontWeight: isUnread ? FontWeight.bold : FontWeight.normal,
                                            height: 1.4,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          notif['timestamp'] != null
                                              ? notif['timestamp'].toString().replaceAll('T', ' ').split('.')[0]
                                              : 'Just now',
                                          style: const TextStyle(color: Colors.grey, fontSize: 10),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      
            const SizedBox(height: 28),
            
            // RECOMMENDED JOBS LISTING
            Text(
              'Recommended Jobs',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            const SizedBox(height: 10),
            FutureBuilder<List<Map<String, dynamic>>>(
              future: fetchJobs(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent));
                } else if (snapshot.hasError || !snapshot.hasData || snapshot.data!.isEmpty) {
                  return const GlassCard(
                    child: Padding(
                      padding: EdgeInsets.all(16.0),
                      child: Text(
                        'No recommended jobs at the moment.',
                        style: TextStyle(color: Colors.grey),
                      ),
                    ),
                  );
                }

                final jobs = snapshot.data!.take(2).toList();
                return Column(
                  children: jobs.map((job) {
                    return GlassCard(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (context) => JobDetailsPage(job: job)),
                        );
                      },
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    job['title'] ?? 'Job Title',
                                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${job['company'] ?? 'CareerCraft Client'} • ${job['location'] ?? 'Remote'}',
                                    style: Theme.of(context).textTheme.bodyMedium,
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.arrow_forward_ios, size: 16),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
