const express = require('express');
const router = express.Router();

// const { pool } = require('../db'); // TODO: Import DB pool correctly when needed

// In-memory settings for now if no DB table
let mernSettings = {
    syncEnabled: true,
    keywords: ['Mobile Money', 'Airtel Money', 'MoMo', 'Received', 'Sent', 'Payment']
};

/**
 * @route   GET /api/mobile-money/settings
 * @desc    Get mobile money settings
 * @access  Private
 */
router.get('/settings', (req, res) => {
    res.json(mernSettings);
});

/**
 * @route   PUT /api/mobile-money/settings
 * @desc    Update mobile money settings
 * @access  Private
 */
router.put('/settings', (req, res) => {
    mernSettings = { ...mernSettings, ...req.body };
    res.json(mernSettings);
});

/**
 * @route   POST /api/mobile-money/parse-sms
 * @desc    Parse SMS text and extract transaction details
 * @access  Private
 */
router.post('/parse-sms', async (req, res) => {
    try {
        const { sms_text } = req.body;

        if (!sms_text) {
            return res.status(400).json({ error: 'SMS text is required' });
        }

        const transaction = parseSMS(sms_text);

        if (!transaction) {
            return res.status(400).json({
                error: 'Could not parse transaction details. Please ensure the SMS matches standard Airtel/MTN formats.',
                parsed_raw: sms_text
            });
        }

        res.json({
            success: true,
            transaction
        });
    } catch (error) {
        console.error('Error parsing SMS:', error);
        res.status(500).json({ error: 'Server error processing SMS' });
    }
});

// Helper function to parse SMS (Inline for now)
function parseSMS(text) {
    // MTN Formats
    // "You have received UGX 50,000 from JOHN DOE..."
    // "You have sent UGX 20,000 to JANE DOE..."

    // Airtel Formats
    // "UGX 50,000 received from 0700000000..."
    // "UGX 20,000 sent to..."

    let amount = 0;
    let type = 'unknown'; // 'income' or 'expense'
    let currency = 'UGX';
    let description = '';
    let date = new Date().toISOString();
    let transaction_id = null;

    // Regex for Amount (UGX X,XXX or X,XXX UGX)
    const amountMatch = text.match(/UGX\s*([\d,]+)/i) || text.match(/([\d,]+)\s*UGX/i);
    if (amountMatch) {
        amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    // Extract Transaction ID (multiple formats)
    // MTN: "TxnId: XXXXX" or "Trans ID: XXXXX" or "Transaction Id XXXXX"
    // Airtel: "Airtel Money ID XXXXX" or "Ref: XXXXX" or "Reference: XXXXX"
    // Banks: "TXN NO: XXXXX" or "Reference: XXXXX"
    const txnIdPatterns = [
        /TxnId[:\s]+([A-Z0-9]+)/i,
        /Trans(?:action)?\s*ID[:\s]+([A-Z0-9]+)/i,
        /Airtel\s*Money\s*ID[:\s]+([A-Z0-9]+)/i,
        /Ref(?:erence)?[:\s]+([A-Z0-9]+)/i,
        /TXN\s*NO[:\s]+([A-Z0-9]+)/i,
        /ID[:\s]+([A-Z0-9]{8,})/i  // Generic ID pattern (at least 8 chars)
    ];

    for (const pattern of txnIdPatterns) {
        const match = text.match(pattern);
        if (match) {
            transaction_id = match[1].trim();
            break;
        }
    }

    // Determine type - INCOME keywords
    // Keywords: received, deposited, credited, cash in, cash deposit, money received
    const incomePatterns = [
        /received\s+from/i,
        /received/i,
        /deposited/i,
        /credited/i,
        /cash\s*in/i,
        /cash\s*deposit/i,
        /money\s*received/i,
        /you\s*have\s*received/i
    ];

    // Determine type - EXPENSE keywords
    // Keywords: sent, paid, payment, bought, debited (NOT withdrawn - that's cash conversion)
    const expensePatterns = [
        /sent\s+to/i,
        /paid\s+to/i,
        /payment\s+to/i,
        /bought/i,
        /debited/i,
        /you\s*have\s*sent/i,
        /you\s*have\s*paid/i
    ];

    // Check income patterns first
    for (const pattern of incomePatterns) {
        if (pattern.test(text)) {
            type = 'income';
            break;
        }
    }

    // Check expense patterns only if not already income
    if (type === 'unknown') {
        for (const pattern of expensePatterns) {
            if (pattern.test(text)) {
                type = 'expense';
                break;
            }
        }
    }

    // Extract Description/Party
    if (type === 'income') {
        const fromMatch = text.match(/received\s+from\s+([A-Z0-9\s]+?)(?=\s+on|\.|,|$)/i) ||
            text.match(/from\s+([A-Z0-9\s]+?)(?=\s+on|\.|,|$)/i);
        if (fromMatch) description = `Received from ${fromMatch[1].trim()}`;
        else description = 'Mobile Money Income';
    } else if (type === 'expense') {
        const toMatch = text.match(/sent\s+to\s+([A-Z0-9\s]+?)(?=\s+on|\.|,|$)/i) ||
            text.match(/paid\s+to\s+([A-Z0-9\s]+?)(?=\s+on|\.|,|$)/i);
        if (toMatch) description = `Sent to ${toMatch[1].trim()}`;
        else description = 'Mobile Money Expense';
    }

    if (amount > 0) {
        const result = {
            amount,
            currency,
            type,
            description: description || 'Mobile Money Transaction',
            date,
            original_sms: text
        };

        // Include transaction ID if found
        if (transaction_id) {
            result.transaction_id = transaction_id;
        }

        return result;
    }
    return null;
}

module.exports = router;
