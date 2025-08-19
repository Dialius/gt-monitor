import fetch from 'node-fetch';

class GrowtopiaApiTester {
    constructor() {
        this.testUrl = 'https://www.growtopiagame.com/detail';
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/122.0.0.0'
        ];
    }

    async testBasicFetch() {
        console.log('🔍 Testing basic fetch...');
        try {
            const response = await fetch(this.testUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': this.userAgents[0]
                }
            });

            console.log(`   Status: ${response.status} ${response.statusText}`);
            console.log(`   Content-Type: ${response.headers.get('content-type')}`);
            console.log(`   Content-Length: ${response.headers.get('content-length')}`);
            
            if (response.ok) {
                const text = await response.text();
                console.log(`   Response length: ${text.length} characters`);
                
                // Try to parse as JSON
                try {
                    const data = JSON.parse(text);
                    console.log('   ✅ Valid JSON response');
                    console.log(`   Online users: ${data.online_user || 'N/A'}`);
                    return { success: true, data, text };
                } catch (parseError) {
                    console.log('   ❌ Not valid JSON, checking if HTML...');
                    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
                        console.log('   📄 Response is HTML content');
                    }
                    return { success: false, error: 'Invalid JSON', text: text.substring(0, 500) };
                }
            } else {
                const text = await response.text();
                return { success: false, error: `HTTP ${response.status}`, text: text.substring(0, 500) };
            }
        } catch (error) {
            console.log(`   ❌ Fetch failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async testWithDifferentUserAgents() {
        console.log('\n🔄 Testing with different User-Agents...');
        
        for (let i = 0; i < this.userAgents.length; i++) {
            const userAgent = this.userAgents[i];
            const browserName = userAgent.includes('Chrome') ? 'Chrome' : 
                              userAgent.includes('Firefox') ? 'Firefox' :
                              userAgent.includes('Edge') ? 'Edge' : 'Unknown';
            
            console.log(`\n   Testing with ${browserName}...`);
            
            try {
                const response = await fetch(this.testUrl, {
                    timeout: 8000,
                    headers: {
                        'User-Agent': userAgent,
                        'Accept': 'application/json, text/html, */*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });

                console.log(`   ${browserName} - Status: ${response.status}`);
                
                if (response.ok) {
                    const text = await response.text();
                    try {
                        const data = JSON.parse(text);
                        console.log(`   ${browserName} - ✅ Success! Online users: ${data.online_user}`);
                        return { success: true, userAgent, data };
                    } catch {
                        console.log(`   ${browserName} - ❌ Not JSON (${text.length} chars)`);
                    }
                }
            } catch (error) {
                console.log(`   ${browserName} - ❌ Failed: ${error.message}`);
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return { success: false };
    }

    async testWithAdditionalHeaders() {
        console.log('\n🔧 Testing with additional headers...');
        
        const headerSets = [
            {
                name: 'Standard Browser',
                headers: {
                    'User-Agent': this.userAgents[0],
                    'Accept': 'application/json, text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                }
            },
            {
                name: 'API Client',
                headers: {
                    'User-Agent': this.userAgents[0],
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            },
            {
                name: 'Mobile Browser',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            }
        ];

        for (const headerSet of headerSets) {
            console.log(`\n   Testing ${headerSet.name}...`);
            
            try {
                const response = await fetch(this.testUrl, {
                    timeout: 8000,
                    headers: headerSet.headers
                });

                console.log(`   Status: ${response.status} ${response.statusText}`);
                
                if (response.ok) {
                    const text = await response.text();
                    try {
                        const data = JSON.parse(text);
                        console.log(`   ✅ Success with ${headerSet.name}!`);
                        console.log(`   Online users: ${data.online_user}`);
                        console.log(`   World day image: ${data.world_day_images?.full_size || 'N/A'}`);
                        return { success: true, method: headerSet.name, data };
                    } catch {
                        console.log(`   ❌ Response not JSON (${text.length} chars)`);
                        if (text.length < 200) {
                            console.log(`   Response preview: ${text}`);
                        }
                    }
                } else {
                    console.log(`   ❌ HTTP Error: ${response.status}`);
                }
            } catch (error) {
                console.log(`   ❌ Request failed: ${error.message}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        return { success: false };
    }

    async testCORS() {
        console.log('\n🌐 Testing CORS policy...');
        
        try {
            const response = await fetch(this.testUrl, {
                method: 'OPTIONS',
                headers: {
                    'Origin': 'http://localhost:3000',
                    'Access-Control-Request-Method': 'GET',
                    'Access-Control-Request-Headers': 'Content-Type'
                }
            });
            
            console.log(`   OPTIONS Status: ${response.status}`);
            console.log(`   CORS Headers:`);
            console.log(`     Access-Control-Allow-Origin: ${response.headers.get('access-control-allow-origin') || 'Not set'}`);
            console.log(`     Access-Control-Allow-Methods: ${response.headers.get('access-control-allow-methods') || 'Not set'}`);
            console.log(`     Access-Control-Allow-Headers: ${response.headers.get('access-control-allow-headers') || 'Not set'}`);
            
        } catch (error) {
            console.log(`   ❌ CORS test failed: ${error.message}`);
        }
    }

    async runAllTests() {
        console.log('🚀 Starting Growtopia Official API Tests');
        console.log(`📍 Target URL: ${this.testUrl}`);
        console.log('=' .repeat(60));

        // Test 1: Basic fetch
        const basicResult = await this.testBasicFetch();
        
        if (basicResult.success) {
            console.log('\n✅ Basic test successful! API is accessible.');
            return basicResult;
        }

        // Test 2: Different User-Agents
        const userAgentResult = await this.testWithDifferentUserAgents();
        
        if (userAgentResult.success) {
            console.log('\n✅ User-Agent test successful!');
            return userAgentResult;
        }

        // Test 3: Additional headers
        const headerResult = await this.testWithAdditionalHeaders();
        
        if (headerResult.success) {
            console.log('\n✅ Header test successful!');
            return headerResult;
        }

        // Test 4: CORS
        await this.testCORS();

        console.log('\n❌ All tests failed. The API might be:');
        console.log('   - Protected by anti-bot measures');
        console.log('   - Requiring authentication');
        console.log('   - Blocking server-side requests');
        console.log('   - Only accessible from browser context');
        console.log('   - Currently down or changed endpoint');

        return { success: false, allTestsFailed: true };
    }

    // Method to integrate into your existing DataFetcher
    getOptimalFetchConfig(testResult) {
        if (!testResult.success) {
            return null;
        }

        return {
            url: this.testUrl,
            headers: testResult.userAgent ? 
                { 'User-Agent': testResult.userAgent } : 
                {
                    'User-Agent': this.userAgents[0],
                    'Accept': 'application/json, text/html, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache'
                },
            timeout: 8000
        };
    }
}

// Test function
async function testGrowtopiaApi() {
    const tester = new GrowtopiaApiTester();
    const result = await tester.runAllTests();
    
    if (result.success) {
        console.log('\n🎉 RESULT: Growtopia official API is accessible!');
        console.log('💡 Recommended configuration:');
        const config = tester.getOptimalFetchConfig(result);
        console.log(JSON.stringify(config, null, 2));
        
        console.log('\n📊 Sample data structure:');
        console.log(JSON.stringify(result.data, null, 2));
    } else {
        console.log('\n💔 RESULT: Growtopia official API is not accessible via server-side requests');
        console.log('🔄 Alternative: Consider using existing APIs (Noire, GTID) as they are working');
    }
    
    return result;
}

// Run the test
testGrowtopiaApi().catch(console.error);

export { GrowtopiaApiTester, testGrowtopiaApi };