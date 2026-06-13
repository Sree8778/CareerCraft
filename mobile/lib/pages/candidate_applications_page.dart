import 'package:flutter/material.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:recruit_edge/pages/job_details_page.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class CandidateApplicationsPage extends StatefulWidget {
  const CandidateApplicationsPage({super.key});

  @override
  State<CandidateApplicationsPage> createState() => _CandidateApplicationsPageState();
}

class _CandidateApplicationsPageState extends State<CandidateApplicationsPage> {
  List<dynamic> _applications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadApplications();
  }

  Future<void> _loadApplications() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      setState(() {
        _isLoading = false;
      });
      return;
    }

    try {
      final fetched = await fetchApplications(user.uid);
      if (mounted) {
        setState(() {
          _applications = fetched;
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Error fetching apps on page: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _navigateToJobDetails(Map<String, dynamic> app) async {
    setState(() {
      _isLoading = true;
    });

    try {
      final user = FirebaseAuth.instance.currentUser;
      final token = user != null ? 'mock_token' : 'demo_token';
      
      // Fetch full job detail from backend
      final response = await http.get(
        Uri.parse('$baseUrl/jobs/${app['jobId']}'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (response.statusCode == 200) {
        final jobData = jsonDecode(response.body);
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => JobDetailsPage(job: jobData)),
          );
        }
      } else {
        // Fallback with minimal job card details if server lookup fails
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => JobDetailsPage(job: {
              'id': app['jobId'],
              'title': app['jobTitle'],
              'company': app['company'] ?? 'CareerCraft Client',
              'location': 'Remote',
              'description': 'View your application status and notes inside this panel.',
            })),
          );
        }
      }
    } catch (e) {
      print('Failed to load full job details: $e');
      if (mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => JobDetailsPage(job: {
            'id': app['jobId'],
            'title': app['jobTitle'],
            'company': app['company'] ?? 'CareerCraft Client',
            'location': 'Remote',
            'description': 'View your application status and notes inside this panel.',
          })),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDarkMode ? const Color(0xFF0F0C20) : Colors.white,
      appBar: AppBar(
        title: const Text('My Applications', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: isDarkMode ? Colors.white : Colors.black),
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
            : _applications.isEmpty
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.assignment_outlined, size: 48, color: Colors.grey),
                          SizedBox(height: 16),
                          Text(
                            'You haven\'t applied to any roles yet. Browse jobs to begin!',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.grey, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _loadApplications,
                    color: Colors.deepPurpleAccent,
                    child: ListView.builder(
                      padding: const EdgeInsets.all(16.0),
                      itemCount: _applications.length,
                      itemBuilder: (context, idx) {
                        final app = _applications[idx];
                        final status = app['status'] ?? 'Applied';
                        
                        Color statusColor = Colors.blue;
                        if (status == 'Hired' || status == 'Shortlisted') {
                          statusColor = Colors.green;
                        } else if (status == 'Interviewed' || status == 'In Review') {
                          statusColor = Colors.indigoAccent;
                        } else if (status == 'Rejected') {
                          statusColor = Colors.red;
                        }

                        return GlassCard(
                          margin: const EdgeInsets.only(bottom: 12),
                          onTap: () => _navigateToJobDetails(app),
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
                                        app['jobTitle'] ?? 'Job Requisition',
                                        style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87, fontWeight: FontWeight.bold, fontSize: 15),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '${app['company'] ?? 'CareerCraft Client'} • Applied: ${app['appliedDate'] ?? ''}',
                                        style: TextStyle(color: isDarkMode ? Colors.white60 : Colors.black54, fontSize: 12),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: statusColor.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    status.toUpperCase(),
                                    style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 10),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
      ),
    );
  }
}
