// Test if API endpoints are working properly
const fetch = require('node-fetch');

async function testAPI() {
    try {
        // Test login first
        console.log('Testing login...');
        const loginResponse = await fetch('http://localhost:5000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123'
            })
        });
        
        const loginData = await loginResponse.json();
        console.log('Login response:', loginData);
        
        if (!loginResponse.ok) {
            console.error('Login failed');
            return;
        }
        
        // Get cookies for session
        const cookies = loginResponse.headers.get('set-cookie');
        console.log('Session cookies:', cookies);
        
        // Test audit report creation
        console.log('\nTesting audit report creation...');
        const reportResponse = await fetch('http://localhost:5000/api/reports', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies
            },
            body: JSON.stringify({
                auditId: 'AUD-API-TEST-001',
                formName: 'API Test Form',
                agent: 'API Test Agent',
                agentId: 'AGENT-API-001',
                auditorName: 'admin',
                sectionAnswers: { test: 'data' },
                score: 95,
                maxScore: 100,
                hasFatal: false,
                status: 'completed'
            })
        });
        
        if (reportResponse.ok) {
            const reportData = await reportResponse.json();
            console.log('Report created successfully:', reportData);
        } else {
            const errorText = await reportResponse.text();
            console.error('Report creation failed:', reportResponse.status, errorText);
        }
        
        // Test form creation
        console.log('\nTesting form creation...');
        const formResponse = await fetch('http://localhost:5000/api/forms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies
            },
            body: JSON.stringify({
                name: 'API Test Form Creation',
                sections: [{ name: 'Test Section', questions: [{ id: 'q1', text: 'Test Question' }] }]
            })
        });
        
        if (formResponse.ok) {
            const formData = await formResponse.json();
            console.log('Form created successfully:', formData);
        } else {
            const errorText = await formResponse.text();
            console.error('Form creation failed:', formResponse.status, errorText);
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testAPI();