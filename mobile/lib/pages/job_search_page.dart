import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:recruit_edge/pages/job_details_page.dart';

class JobSearchPage extends StatefulWidget {
  const JobSearchPage({super.key});

  @override
  State<JobSearchPage> createState() => _JobSearchPageState();
}

class _JobSearchPageState extends State<JobSearchPage> {
  final TextEditingController _searchController = TextEditingController();
  List<dynamic> _jobs = [];
  List<dynamic> _dynamicJobs = [];
  bool _isLoading = false;
  String _searchedQuery = "";

  @override
  void initState() {
    super.initState();
    _fetchDynamicJobs();
  }

  Future<void> _fetchDynamicJobs() async {
    setState(() {
      _isLoading = true;
    });
    try {
      final fetched = await fetchJobs();
      setState(() {
        _dynamicJobs = fetched;
      });
    } catch (e) {
      print('Failed to fetch dynamic jobs: $e');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  // Dynamic semantic job search REST call
  Future<void> _performSemanticSearch() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) return;

    setState(() {
      _isLoading = true;
      _searchedQuery = query;
    });

    try {
      final user = FirebaseAuth.instance.currentUser;
      final token = user != null ? 'mock_token' : 'demo_token';

      final response = await http.post(
        Uri.parse('$baseUrl/jobs/search-semantic'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'query': query,
          'jobs': _dynamicJobs,
        }),
      );

      if (response.statusCode == 200) {
        final List<dynamic> matchedList = jsonDecode(response.body);
        setState(() {
          _jobs = matchedList;
        });
      } else {
        throw Exception('Server error: ${response.statusCode}');
      }
    } catch (e) {
      print('Semantic job search failed: $e. Proceeding with simulated matches.');
      // Simulating semantic match sorting
      setState(() {
        _jobs = _getSimulatedMatchedJobs(query);
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDarkMode ? const Color(0xFF0F0C20) : Colors.white,
      appBar: AppBar(
        title: const Text('AI Conversational Job Search', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: isDarkMode ? Colors.white : Colors.black),
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Conversational AI Prompt Bar
                  TextField(
                    controller: _searchController,
                    style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87),
                    decoration: InputDecoration(
                      labelText: 'What kind of job are you looking for?',
                      labelStyle: TextStyle(color: isDarkMode ? darkMutedTextColor : mutedTextColor),
                      hintText: 'e.g. "remote react role with good work-life balance"',
                      hintStyle: TextStyle(color: isDarkMode ? Colors.white38 : Colors.black38),
                      prefixIcon: const Icon(Icons.psychology, color: Colors.deepPurpleAccent),
                      suffixIcon: IconButton(
                        icon: const Icon(Icons.send, color: Colors.deepPurpleAccent),
                        onPressed: _performSemanticSearch,
                      ),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      filled: true,
                      fillColor: isDarkMode ? Colors.black.withOpacity(0.2) : Colors.grey.withOpacity(0.05),
                    ),
                    onSubmitted: (_) => _performSemanticSearch(),
                  ),
                  const SizedBox(height: 20),
                  
                  // Results headers
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _jobs.isEmpty ? 'Suggested Job Listings' : 'AI Sorted Matches',
                        style: TextStyle(
                          color: isDarkMode ? Colors.white : Colors.black87,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (_jobs.isNotEmpty)
                        Text(
                          '${_jobs.length} roles found',
                          style: const TextStyle(color: Colors.deepPurpleAccent, fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Listings Grid/List
                  Expanded(
                    child: _isLoading
                        ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
                        : _jobs.isEmpty
                            ? _buildBaseSuggestedJobs(isDarkMode)
                            : _buildSemanticResultsList(isDarkMode),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  // Render initial standard listings
  Widget _buildBaseSuggestedJobs(bool isDarkMode) {
    if (_dynamicJobs.isEmpty) {
      return const Center(
        child: Text('No job listings available right now.', style: TextStyle(color: Colors.grey)),
      );
    }
    return ListView.builder(
      itemCount: _dynamicJobs.length,
      itemBuilder: (context, idx) {
        final job = _dynamicJobs[idx];
        return Card(
          color: isDarkMode ? Colors.white.withOpacity(0.04) : Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: isDarkMode ? Colors.white12 : Colors.grey.withOpacity(0.2)),
          ),
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            contentPadding: const EdgeInsets.all(16),
            title: Text(job['title'] ?? '', style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87, fontWeight: FontWeight.bold)),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 4),
                Text('${job['company'] ?? 'CareerCraft Client'} • ${job['location'] ?? 'Remote'} • ${job['jobType'] ?? 'Full-Time'}', style: TextStyle(color: isDarkMode ? Colors.white60 : Colors.black54, fontSize: 13)),
                const SizedBox(height: 8),
                Text(job['description'] ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: isDarkMode ? Colors.white38 : Colors.black38, fontSize: 12)),
              ],
            ),
            trailing: const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.deepPurpleAccent),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => JobDetailsPage(job: job)),
              );
            },
          ),
        );
      },
    );
  }

  // Render semantic Gemini match cards
  Widget _buildSemanticResultsList(bool isDarkMode) {
    return ListView.builder(
      itemCount: _jobs.length,
      itemBuilder: (context, idx) {
        final job = _jobs[idx];
        final matchScore = job['matchPercentage'] ?? job['matchScore'] ?? 80;
        final fitDescription = job['matchDescription'] ?? job['fitDescription'] ?? job['copilotReasoning'] ?? "Matches your skill filters.";

        Color scoreColor = Colors.green;
        if (matchScore < 60) {
          scoreColor = Colors.amber;
        } else if (matchScore < 40) {
          scoreColor = Colors.red;
        }

        return GestureDetector(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => JobDetailsPage(job: job)),
            );
          },
          child: Card(
            color: isDarkMode ? Colors.white.withOpacity(0.04) : Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: isDarkMode ? Colors.white12 : Colors.grey.withOpacity(0.2)),
            ),
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          job['title'] ?? '',
                          style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87, fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: scoreColor.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '$matchScore% FIT',
                          style: TextStyle(color: scoreColor, fontWeight: FontWeight.bold, fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${job['company']} • ${job['location']} • ${job['jobType']}',
                    style: TextStyle(color: isDarkMode ? Colors.white60 : Colors.black54, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  
                  // AI reasoning block
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.deepPurpleAccent.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.deepPurpleAccent.withOpacity(0.2)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.psychology, color: Colors.deepPurpleAccent, size: 16),
                            SizedBox(width: 6),
                            Text('AI FIT REASONING', style: TextStyle(color: Colors.deepPurpleAccent, fontSize: 10, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          fitDescription,
                          style: TextStyle(color: isDarkMode ? Colors.white70 : Colors.black87, fontSize: 12, height: 1.4),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    job['description'] ?? '',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: isDarkMode ? Colors.white38 : Colors.black38, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  // Simulate semantic query matches
  List<dynamic> _getSimulatedMatchedJobs(String query) {
    if (_dynamicJobs.isEmpty) return [];
    
    final lower = query.toLowerCase();
    return _dynamicJobs.map((job) {
      final title = (job['title'] ?? '').toString().toLowerCase();
      final desc = (job['description'] ?? '').toString().toLowerCase();
      
      int score = 70;
      String reason = "Matches your skill profile and interests.";
      
      if (lower.split(' ').any((word) => word.length > 2 && (title.contains(word) || desc.contains(word)))) {
        score = 92;
        reason = "Excellent match! The job details strongly align with your prompt query criteria.";
      } else if (lower.contains('remote') && (title.contains('remote') || desc.contains('remote'))) {
        score = 88;
        reason = "Great match! This role accommodates remote schedules requested in your query.";
      }
      
      return {
        ...job,
        'matchPercentage': score,
        'matchDescription': reason,
      };
    }).toList()..sort((a, b) => (b['matchPercentage'] as int).compareTo(a['matchPercentage'] as int));
  }
}
