import 'package:flutter/material.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'dart:async';

class CandidateSmartApplyPage extends StatefulWidget {
  const CandidateSmartApplyPage({super.key});

  @override
  State<CandidateSmartApplyPage> createState() => _CandidateSmartApplyPageState();
}

class _CandidateSmartApplyPageState extends State<CandidateSmartApplyPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();
  
  List<dynamic> _queue = [];
  List<dynamic> _progressLogs = [];
  List<dynamic> _searchResults = [];
  
  bool _autonomousRunning = false;
  int _appliedToday = 0;
  int _dailyCap = 10;
  
  bool _isLoading = true;
  bool _isSearching = false;
  bool _isActionLoading = false;
  
  Timer? _statusTimer;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _refreshAll();
    // Poll status every 5 seconds when autopilot is running to show real-time logs
    _statusTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (_autonomousRunning) {
        _loadStatus(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _statusTimer?.cancel();
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refreshAll({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoading = true;
      });
    }
    await Future.wait([
      _loadQueue(),
      _loadStatus(silent: true),
    ]);
    if (mounted) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _loadQueue() async {
    try {
      final q = await fetchSmartApplyQueue();
      if (mounted) {
        setState(() {
          _queue = q;
        });
      }
    } catch (e) {
      print("Error loading smart queue: $e");
    }
  }

  Future<void> _loadStatus({bool silent = false}) async {
    try {
      final status = await fetchSmartApplyStatus();
      if (status != null && mounted) {
        setState(() {
          _autonomousRunning = status['autonomous_running'] ?? false;
          _appliedToday = status['applied_today'] ?? 0;
          _progressLogs = status['progress'] ?? [];
        });
      }
    } catch (e) {
      print("Error loading smart status: $e");
    }
  }

  Future<void> _toggleAutopilot() async {
    setState(() {
      _isActionLoading = true;
    });

    try {
      bool success;
      if (_autonomousRunning) {
        success = await stopAutonomousApply();
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Autopilot Bot stopped.')),
          );
        }
      } else {
        if (_queue.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Your queue is empty. Search and add jobs first!'), backgroundColor: Colors.redAccent),
          );
          setState(() {
            _isActionLoading = false;
          });
          return;
        }
        success = await startAutonomousApply(_dailyCap);
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Autopilot Bot started with cap of $_dailyCap!'), backgroundColor: Colors.green),
          );
        }
      }
      await _loadStatus();
    } catch (e) {
      print("Error toggling Autopilot: $e");
    } finally {
      if (mounted) {
        setState(() {
          _isActionLoading = false;
        });
      }
    }
  }

  Future<void> _searchJobs() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) return;

    setState(() {
      _isSearching = true;
      _searchResults = [];
    });

    try {
      final results = await searchSmartApplyJobs(query);
      if (mounted) {
        setState(() {
          _searchResults = results;
        });
      }
    } catch (e) {
      print("Error searching jobs: $e");
    } finally {
      if (mounted) {
        setState(() {
          _isSearching = false;
        });
      }
    }
  }

  Future<void> _addToQueue(Map<String, dynamic> job) async {
    final jobId = job['id']?.toString() ?? '';
    if (jobId.isEmpty) return;

    setState(() {
      _isActionLoading = true;
    });

    try {
      final success = await addToSmartApplyQueue(jobId);
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Added "${job['title']}" to Queue.'), backgroundColor: Colors.green),
        );
        await _loadQueue();
        setState(() {
          // Remove from search results once added to prevent duplicate additions
          _searchResults.removeWhere((item) => item['id']?.toString() == jobId);
        });
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to add job to queue.'), backgroundColor: Colors.redAccent),
        );
      }
    } catch (e) {
      print("Error adding job: $e");
    } finally {
      if (mounted) {
        setState(() {
          _isActionLoading = false;
        });
      }
    }
  }

  Future<void> _removeFromQueue(String jobId, String jobTitle) async {
    setState(() {
      _isActionLoading = true;
    });

    try {
      final success = await removeFromSmartApplyQueue(jobId);
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Removed "$jobTitle" from Queue.')),
        );
        await _loadQueue();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to remove job from queue.'), backgroundColor: Colors.redAccent),
        );
      }
    } catch (e) {
      print("Error removing job: $e");
    } finally {
      if (mounted) {
        setState(() {
          _isActionLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Colors.indigoAccent;

    return Scaffold(
      backgroundColor: isDarkMode ? const Color(0xFF0F0C20) : Colors.grey[50],
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.bolt, color: Colors.indigoAccent),
            SizedBox(width: 8),
            Text('Smart Apply Autopilot', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: isDarkMode ? Colors.white : Colors.black87),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _refreshAll(),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: primaryColor,
          labelColor: isDarkMode ? Colors.white : Colors.black87,
          unselectedLabelColor: Colors.grey,
          tabs: const [
            Tab(text: 'Application Queue', icon: Icon(Icons.queue_play_next, size: 20)),
            Tab(text: 'Autopilot Logs', icon: Icon(Icons.receipt_long, size: 20)),
          ],
        ),
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: Colors.indigoAccent))
            : Column(
                children: [
                  // Status & Controls Header
                  _buildAutopilotControlPanel(isDarkMode),
                  
                  // Tab Content
                  Expanded(
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        _buildQueueTab(isDarkMode),
                        _buildLogsTab(isDarkMode),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildAutopilotControlPanel(bool isDarkMode) {
    return GlassCard(
      margin: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Autopilot Status',
                    style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _autonomousRunning ? Colors.green : Colors.red,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _autonomousRunning ? 'Active & Searching' : 'Disabled / Paused',
                        style: TextStyle(
                          color: isDarkMode ? Colors.white : Colors.black87,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              _isActionLoading
                  ? const CircularProgressIndicator(color: Colors.indigoAccent)
                  : ElevatedButton.icon(
                      onPressed: _toggleAutopilot,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _autonomousRunning ? Colors.redAccent : Colors.indigoAccent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      icon: Icon(_autonomousRunning ? Icons.stop : Icons.play_arrow, size: 18),
                      label: Text(_autonomousRunning ? 'Stop Autopilot' : 'Start Autopilot'),
                    ),
            ],
          ),
          const Divider(height: 24, color: Colors.white10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Applied Today', style: TextStyle(color: Colors.grey, fontSize: 11)),
                  const SizedBox(height: 2),
                  Text('$_appliedToday jobs', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('Daily Limit Cap', style: TextStyle(color: Colors.grey, fontSize: 11)),
                  const SizedBox(height: 2),
                  DropdownButton<int>(
                    value: _dailyCap,
                    dropdownColor: isDarkMode ? const Color(0xFF0F0C20) : Colors.white,
                    style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87, fontWeight: FontWeight.bold),
                    items: [5, 10, 15, 20].map((int val) {
                      return DropdownMenuItem<int>(
                        value: val,
                        child: Text('$val Jobs / Day'),
                      );
                    }).toList(),
                    onChanged: _autonomousRunning
                        ? null // Lock Cap while active
                        : (val) {
                            if (val != null) {
                              setState(() {
                                _dailyCap = val;
                              });
                            }
                          },
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQueueTab(bool isDarkMode) {
    return Column(
      children: [
        // Job Search Bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87),
                  decoration: InputDecoration(
                    hintText: 'Search jobs to add to queue...',
                    hintStyle: TextStyle(color: isDarkMode ? Colors.white38 : Colors.grey[400]),
                    prefixIcon: const Icon(Icons.search, color: Colors.grey),
                    filled: true,
                    fillColor: isDarkMode ? Colors.white.withOpacity(0.05) : Colors.white,
                    contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: isDarkMode ? Colors.white10 : Colors.grey[300]!),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Colors.indigoAccent),
                    ),
                  ),
                  onSubmitted: (_) => _searchJobs(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: _isSearching
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.indigoAccent))
                    : const Icon(Icons.search, color: Colors.indigoAccent),
                onPressed: _searchJobs,
              ),
            ],
          ),
        ),

        // Search Results Section
        if (_searchResults.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Search Results',
                style: TextStyle(color: Colors.indigoAccent, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          Container(
            height: 120,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _searchResults.length,
              itemBuilder: (context, idx) {
                final job = _searchResults[idx];
                return Container(
                  width: 220,
                  margin: const EdgeInsets.only(right: 12, bottom: 8),
                  child: GlassCard(
                    margin: EdgeInsets.zero,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              job['title'] ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              job['company'] ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: Colors.grey, fontSize: 11),
                            ),
                          ],
                        ),
                        Align(
                          alignment: Alignment.bottomRight,
                          child: InkWell(
                            onTap: () => _addToQueue(job),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.indigoAccent,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.add, size: 12, color: Colors.white),
                                  SizedBox(width: 4),
                                  Text('Add Queue', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],

        // Queue List Section
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Queued Applications',
              style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ),
        ),

        Expanded(
          child: _queue.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.layers_clear, size: 48, color: Colors.grey[700]),
                      const SizedBox(height: 16),
                      const Text(
                        'Your Queue is empty.',
                        style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Search and add jobs to start applying.',
                        style: TextStyle(color: Colors.grey, fontSize: 11),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _queue.length,
                  itemBuilder: (context, idx) {
                    final item = _queue[idx];
                    final title = item['title'] ?? 'Job Title';
                    final company = item['company'] ?? 'Company';
                    final location = item['location'] ?? 'Remote';
                    final jobId = item['id']?.toString() ?? '';

                    return GlassCard(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: CircleAvatar(
                          backgroundColor: Colors.indigoAccent.withOpacity(0.1),
                          child: const Icon(Icons.work_outline, color: Colors.indigoAccent),
                        ),
                        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        subtitle: Text('$company • $location', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                          onPressed: () => _removeFromQueue(jobId, title),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildLogsTab(bool isDarkMode) {
    return Column(
      children: [
        const Padding(
          padding: EdgeInsets.all(16),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Live Autopilot Logs',
              style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ),
        ),
        Expanded(
          child: _progressLogs.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.history_toggle_off, size: 48, color: Colors.grey[700]),
                      const SizedBox(height: 16),
                      const Text(
                        'No logs recorded yet.',
                        style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Logs will appear once autopilot begins submitting.',
                        style: TextStyle(color: Colors.grey, fontSize: 11),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _progressLogs.length,
                  itemBuilder: (context, idx) {
                    final log = _progressLogs[idx];
                    // Handles logs that are simple strings or maps (depending on schema)
                    final String logText = log is Map ? (log['message'] ?? '') : log.toString();
                    final String logTime = log is Map ? (log['timestamp'] ?? '') : '';

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8.0),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            '• ',
                            style: TextStyle(color: Colors.indigoAccent, fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  logText,
                                  style: TextStyle(
                                    color: isDarkMode ? Colors.white70 : Colors.black87,
                                    fontSize: 12,
                                    fontFamily: 'monospace',
                                    height: 1.4,
                                  ),
                                ),
                                if (logTime.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    logTime,
                                    style: const TextStyle(color: Colors.grey, fontSize: 9),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
