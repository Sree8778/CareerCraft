import 'package:flutter/material.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:recruit_edge/pages/recruiter_candidate_details_page.dart';
import 'package:recruit_edge/api/api_service.dart';

class RecruiterCandidatesPage extends StatefulWidget {
  const RecruiterCandidatesPage({super.key});

  @override
  State<RecruiterCandidatesPage> createState() => _RecruiterCandidatesPageState();
}

class _RecruiterCandidatesPageState extends State<RecruiterCandidatesPage> {
  final TextEditingController _searchController = TextEditingController();
  List<dynamic> _candidates = [];
  bool _isLoading = false;
  String _searchedQuery = "";

  @override
  void initState() {
    super.initState();
    _loadCandidates();
  }

  Future<void> _loadCandidates() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
    });
    try {
      final list = await fetchCandidates();
      if (!mounted) return;
      setState(() {
        _candidates = list;
      });
    } catch (e) {
      print('Failed to load candidates: $e');
    } finally {
      if (mounted) setState(() { _isLoading = false; });
    }
  }

  // Call Recruiter AI Copilot search endpoint
  Future<void> _performCopilotSearch() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) {
      _loadCandidates();
      setState(() {
        _searchedQuery = "";
      });
      return;
    }

    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _searchedQuery = query;
    });

    try {
      final matchedList = await searchCandidatesCopilot(query);
      if (!mounted) return;
      setState(() {
        _candidates = matchedList;
      });
    } catch (e) {
      print('Recruiter Copilot search failed: $e. Proceeding with dynamic simulated matching.');
      if (!mounted) return;
      // Simulating semantic match sorting dynamically against the current active candidate list
      setState(() {
        _candidates = _getSimulatedMatchedCandidates(query);
      });
    } finally {
      if (mounted) setState(() { _isLoading = false; });
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
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Candidates Directory',
                    style: TextStyle(
                      color: isDarkMode ? Colors.white : Colors.black87,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  
                  // Interactive Recruiter AI Copilot search
                  TextField(
                    controller: _searchController,
                    style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87),
                    decoration: InputDecoration(
                      labelText: 'Ask Recruiter AI Copilot to find candidates...',
                      labelStyle: TextStyle(color: isDarkMode ? darkMutedTextColor : mutedTextColor),
                      hintText: 'e.g. "Find Flutter devs who know cloud databases"',
                      hintStyle: TextStyle(color: isDarkMode ? Colors.white38 : Colors.black38),
                      prefixIcon: const Icon(Icons.psychology, color: Colors.deepPurpleAccent),
                      suffixIcon: IconButton(
                        icon: const Icon(Icons.search, color: Colors.deepPurpleAccent),
                        onPressed: _performCopilotSearch,
                      ),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      filled: true,
                      fillColor: isDarkMode ? Colors.black.withOpacity(0.2) : Colors.grey.withOpacity(0.05),
                    ),
                    onSubmitted: (_) => _performCopilotSearch(),
                  ),
                  const SizedBox(height: 20),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _searchedQuery.isEmpty ? 'All Profiles' : 'Copilot Ranked Candidates',
                        style: TextStyle(
                          color: isDarkMode ? Colors.white : Colors.black87,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (_searchedQuery.isNotEmpty)
                        Text(
                          '${_candidates.length} matches sorted',
                          style: const TextStyle(color: Colors.deepPurpleAccent, fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Candidates list
                  Expanded(
                    child: _isLoading
                        ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
                        : _candidates.isEmpty
                            ? const Center(
                                child: Text(
                                  'No profiles found in database.',
                                  style: TextStyle(color: Colors.grey),
                                ),
                              )
                            : _buildCandidatesList(isDarkMode),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  // Render dynamic list of candidates
  Widget _buildCandidatesList(bool isDarkMode) {
    return RefreshIndicator(
      onRefresh: _loadCandidates,
      color: Colors.deepPurpleAccent,
      child: ListView.builder(
        itemCount: _candidates.length,
        itemBuilder: (context, idx) {
          final cand = _candidates[idx];
          final matchScore = cand['matchScore'] ?? cand['matchPercentage'];
          final copilotReasoning = cand['copilotReasoning'] ?? cand['matchDescription'];

          Color scoreColor = Colors.green;
          if (matchScore != null) {
            if (matchScore < 60) {
              scoreColor = Colors.amber;
            } else if (matchScore < 40) {
              scoreColor = Colors.red;
            }
          }

          return Card(
            color: isDarkMode ? Colors.white.withOpacity(0.04) : Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: isDarkMode ? Colors.white12 : Colors.grey.withOpacity(0.2)),
            ),
            margin: const EdgeInsets.only(bottom: 12),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => RecruiterCandidateDetailsPage(candidateData: cand),
                  ),
                );
              },
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: Colors.deepPurpleAccent.withOpacity(0.2),
                          child: Text(
                            cand['name'] != null && cand['name'].toString().isNotEmpty
                                ? cand['name'][0].toString().toUpperCase()
                                : 'C',
                            style: const TextStyle(color: Colors.deepPurpleAccent, fontWeight: FontWeight.bold),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                cand['name'] ?? 'Anonymous Candidate',
                                style: TextStyle(
                                  color: isDarkMode ? Colors.white : Colors.black87,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                              Text(
                                '${cand['title'] ?? 'Software Professional'} • ${cand['location'] ?? 'Remote'}',
                                style: TextStyle(
                                  color: isDarkMode ? Colors.white60 : Colors.black54,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (matchScore != null)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: scoreColor.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '$matchScore%',
                              style: TextStyle(color: scoreColor, fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                          ),
                      ],
                    ),
                    if (copilotReasoning != null && copilotReasoning.toString().isNotEmpty) ...[
                      const SizedBox(height: 16),
                      // AI Recruiter Copilot Reasoning block
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
                                Text('AI COPILOT MATCH REASONING', style: TextStyle(color: Colors.deepPurpleAccent, fontSize: 10, fontWeight: FontWeight.bold)),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              copilotReasoning.toString(),
                              style: TextStyle(color: isDarkMode ? Colors.white70 : Colors.black87, fontSize: 12, height: 1.4),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // Simulate copilot sorting dynamically
  List<dynamic> _getSimulatedMatchedCandidates(String query) {
    final lower = query.toLowerCase();
    return _candidates.map((cand) {
      final name = cand['name'] ?? 'Candidate';
      final title = cand['title'] ?? '';
      final skills = cand['skills'] ?? '';
      
      int score = 50;
      String reasoning = "Candidate profile matches search parameters.";
      
      if (lower.contains('flutter') || lower.contains('mobile')) {
        if (skills.toLowerCase().contains('flutter') || title.toLowerCase().contains('flutter')) {
          score = 95;
          reasoning = "Stellar Candidate! $name possesses expert experience developing state-of-the-art Flutter systems.";
        } else if (skills.toLowerCase().contains('design') || title.toLowerCase().contains('design')) {
          score = 70;
          reasoning = "$name is a brilliant UI/UX Designer who focuses on mobile screens, aligning closely with mobile experiences.";
        } else {
          score = 40;
          reasoning = "$name is qualified, but skills are focused elsewhere rather than mobile Flutter builds.";
        }
      } else if (lower.contains('python') || lower.contains('backend')) {
        if (skills.toLowerCase().contains('python') || skills.toLowerCase().contains('flask')) {
          score = 96;
          reasoning = "Stellar Candidate! $name matches your exact request. Expert Backend Engineer with deep database configurations.";
        } else {
          score = 55;
          reasoning = "$name is primarily a front-end or client engineer, connecting to backend APIs but not building them.";
        }
      }
      
      return {
        ...cand,
        'matchScore': score,
        'copilotReasoning': reasoning,
      };
    }).toList()..sort((a, b) => (b['matchScore'] as int).compareTo(a['matchScore'] as int));
  }
}