import 'package:flutter/material.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/widgets/glass_card.dart';

class RecruiterWebhooksPage extends StatefulWidget {
  const RecruiterWebhooksPage({super.key});

  @override
  State<RecruiterWebhooksPage> createState() => _RecruiterWebhooksPageState();
}

class _RecruiterWebhooksPageState extends State<RecruiterWebhooksPage> {
  List<Map<String, dynamic>> _webhooks = [];
  bool _isLoading = true;
  bool _isSubmitting = false;

  final _formKey = GlobalKey<FormState>();
  final _urlController = TextEditingController();
  final _descController = TextEditingController();

  // Tracks ping connection state per Webhook URL
  final Map<String, String> _pingStates = {}; // 'idle', 'pinging', 'success', 'failed'

  @override
  void initState() {
    super.initState();
    _loadWebhooks();
  }

  Future<void> _loadWebhooks() async {
    setState(() {
      _isLoading = true;
    });
    try {
      final subs = await fetchWebhooks();
      setState(() {
        _webhooks = subs;
        _isLoading = false;
      });
    } catch (e) {
      print('Error loading webhooks: $e');
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _handleSubscribe() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSubmitting = true;
    });

    try {
      final newSub = await subscribeWebhook(
        url: _urlController.text.trim(),
        description: _descController.text.trim(),
      );

      if (newSub != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Webhook subscribed successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        _urlController.clear();
        _descController.clear();
        _loadWebhooks();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to subscribe webhook.'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      setState(() {
        _isSubmitting = false;
      });
    }
  }

  Future<void> _testConnection(String url) async {
    setState(() {
      _pingStates[url] = 'pinging';
    });

    try {
      final success = await pingWebhook(url);
      setState(() {
        _pingStates[url] = success ? 'success' : 'failed';
      });

      if (success) {
        Future.delayed(const Duration(seconds: 3), () {
          if (mounted) {
            setState(() {
              _pingStates[url] = 'idle';
            });
          }
        });
      }
    } catch (e) {
      setState(() {
        _pingStates[url] = 'failed';
      });
    }
  }

  @override
  void dispose() {
    _urlController.dispose();
    _descController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final primaryBgColor = isDarkMode ? const Color(0xFF0F0C20) : Colors.white;

    return Scaffold(
      backgroundColor: primaryBgColor,
      appBar: AppBar(
        title: const Text('Webhook Integrations', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: isDarkMode ? Colors.white : Colors.black),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'External System Sync',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Colors.deepPurpleAccent,
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Register webhook listener URLs to synchronize candidate profiles and screening scores with your external ATS.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey),
              ),
              const SizedBox(height: 24),

              // Form card
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Add Webhook Endpoint',
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _urlController,
                          style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87),
                          decoration: InputDecoration(
                            labelText: 'Payload URL',
                            labelStyle: const TextStyle(color: Colors.grey),
                            hintText: 'https://your-server.com/hooks',
                            hintStyle: const TextStyle(color: Colors.grey),
                            prefixIcon: const Icon(Icons.link, color: Colors.deepPurpleAccent),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            filled: true,
                            fillColor: isDarkMode ? Colors.black.withOpacity(0.2) : Colors.grey.withOpacity(0.05),
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Please enter a URL';
                            }
                            if (!value.startsWith('http://') && !value.startsWith('https://')) {
                              return 'URL must start with http:// or https://';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _descController,
                          style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87),
                          decoration: InputDecoration(
                            labelText: 'Description',
                            labelStyle: const TextStyle(color: Colors.grey),
                            hintText: 'e.g., Greenhouse Sync',
                            hintStyle: const TextStyle(color: Colors.grey),
                            prefixIcon: const Icon(Icons.description_outlined, color: Colors.deepPurpleAccent),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            filled: true,
                            fillColor: isDarkMode ? Colors.black.withOpacity(0.2) : Colors.grey.withOpacity(0.05),
                          ),
                        ),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          onPressed: _isSubmitting ? null : _handleSubscribe,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.deepPurpleAccent,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: _isSubmitting
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                )
                              : const Text('Register Webhook', style: TextStyle(fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 30),

              // Webhooks List Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Active Webhooks',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    onPressed: _loadWebhooks,
                    icon: const Icon(Icons.refresh, color: Colors.deepPurpleAccent),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Webhooks List View
              _isLoading
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.symmetric(vertical: 40.0),
                        child: CircularProgressIndicator(color: Colors.deepPurpleAccent),
                      ),
                    )
                  : _webhooks.isEmpty
                      ? GlassCard(
                          child: Padding(
                            padding: const EdgeInsets.all(24.0),
                            child: Column(
                              children: [
                                const Icon(Icons.webhook_outlined, size: 48, color: Colors.grey),
                                const SizedBox(height: 12),
                                Text(
                                  'No webhooks configured',
                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey),
                                ),
                              ],
                            ),
                          ),
                        )
                      : Column(
                          children: _webhooks.map((sub) {
                            final String url = sub['url'] ?? '';
                            final String desc = sub['description'] ?? 'No description';
                            final String state = _pingStates[url] ?? 'idle';

                            return GlassCard(
                              child: Padding(
                                padding: const EdgeInsets.all(16.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: Colors.deepPurpleAccent.withOpacity(0.1),
                                            border: Border.all(color: Colors.deepPurpleAccent.withOpacity(0.3)),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: const Text(
                                            'POST',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.deepPurpleAccent,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            url,
                                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                                  fontWeight: FontWeight.bold,
                                                ),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      desc,
                                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey),
                                    ),
                                    const SizedBox(height: 16),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        if (state == 'pinging')
                                          const Row(
                                            children: [
                                              SizedBox(
                                                width: 14,
                                                height: 14,
                                                child: CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                  color: Colors.amber,
                                                ),
                                              ),
                                              SizedBox(width: 8),
                                              Text('Testing connection...', style: TextStyle(color: Colors.amber, fontSize: 12)),
                                            ],
                                          )
                                        else if (state == 'success')
                                          const Row(
                                            children: [
                                              Icon(Icons.check_circle_outline, color: Colors.green, size: 16),
                                              SizedBox(width: 6),
                                              Text('Success (2xx)', style: TextStyle(color: Colors.green, fontSize: 12)),
                                            ],
                                          )
                                        else if (state == 'failed')
                                          const Row(
                                            children: [
                                              Icon(Icons.error_outline, color: Colors.redAccent, size: 16),
                                              SizedBox(width: 6),
                                              Text('Connection Failed', style: TextStyle(color: Colors.redAccent, fontSize: 12)),
                                            ],
                                          )
                                        else
                                          TextButton.icon(
                                            onPressed: () => _testConnection(url),
                                            icon: const Icon(Icons.play_arrow_outlined, size: 16),
                                            label: const Text('Test Connection'),
                                            style: TextButton.styleFrom(
                                              foregroundColor: Colors.deepPurpleAccent,
                                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }).toList(),
                        ),
            ],
          ),
        ),
      ),
    );
  }
}
