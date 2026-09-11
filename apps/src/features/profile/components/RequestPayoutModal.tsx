import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { Modal, Text, TextInput, Button, Card, Toast, useTheme } from 'foodie-shared-rn';
import { useNavigation } from '@react-navigation/native';
import { useGetBankDetailsQuery } from '../../../api/endpoints/bankAndBusinessApi';
import { useRequestPayoutMutation } from '../../../api/endpoints/settlementsApi';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../../navigation/types';

interface RequestPayoutModalProps {
    visible: boolean;
    onClose: () => void;
    availableBalance: number;
}

export function RequestPayoutModal({ visible, onClose, availableBalance }: RequestPayoutModalProps) {
    const { tokens } = useTheme();
    const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
    const { data: bankData, isLoading: isLoadingBank } = useGetBankDetailsQuery();
    const [requestPayout, { isLoading }] = useRequestPayoutMutation();

    const [amount, setAmount] = useState('');
    const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

    // Form fields for another bank account
    const [useAnotherBank, setUseAnotherBank] = useState(false);
    const [accountHolderName, setAccountHolderName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [ifscCode, setIfscCode] = useState('');
    const [bankName, setBankName] = useState('');

    useEffect(() => {
        if (visible) {
            setAmount('');
            setUseAnotherBank(false);
            setAccountHolderName('');
            setAccountNumber('');
            setIfscCode('');
            setBankName('');
        }
    }, [visible]);

    const bankAccount = bankData?.bankAccount;

    const handleSubmit = async () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            setToast({ message: 'Please enter a valid amount', variant: 'error' });
            return;
        }

        if (numAmount > availableBalance) {
            setToast({ message: 'Amount exceeds available balance', variant: 'error' });
            return;
        }

        let payload;

        if (useAnotherBank) {
            if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
                setToast({ message: 'Please fill all bank details', variant: 'error' });
                return;
            }
            payload = {
                amount: numAmount,
                accountHolderName,
                accountNumber,
                ifscCode,
                bankName,
            };
        } else {
            if (!bankAccount?.accountNumber) {
                setToast({ message: 'No registered bank account found', variant: 'error' });
                return;
            }
            payload = {
                amount: numAmount,
                accountHolderName: bankAccount.accountHolderName || '',
                accountNumber: bankAccount.accountNumber || '',
                ifscCode: bankAccount.ifscCode || '',
                bankName: bankAccount.bankName || '',
            };
        }

        try {
            await requestPayout(payload).unwrap();
            setToast({ message: 'Payout requested successfully. Admin approval pending.', variant: 'success' });
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (error: any) {
            setToast({ message: error?.data?.message || 'Failed to request payout', variant: 'error' });
        }
    };

    return (
        <Modal visible={visible} onRequestClose={onClose} title="Request Payout" accessibilityLabel="Request Payout Modal">
            <Toast
                visible={Boolean(toast)}
                message={toast?.message ?? ''}
                variant={toast?.variant ?? 'success'}
                onDismiss={() => setToast(null)}
                accessibilityLabel="Toast Message"
            />
            <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, gap: tokens.spacing.md }}>
                <View style={{ backgroundColor: '#F0FDF4', padding: tokens.spacing.md, borderRadius: 12 }}>
                    <Text variant="caption" style={{ color: '#166534' }}>Available Balance</Text>
                    <Text variant="heading2" style={{ color: '#166534' }}>₹{availableBalance.toFixed(2)}</Text>
                </View>

                <TextInput
                    label="Amount to Request"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    accessibilityLabel="Amount to request input"
                />

                {!useAnotherBank ? (
                    <Card style={{ padding: tokens.spacing.md, gap: tokens.spacing.sm, backgroundColor: '#F8FAFC' }}>
                        <Text variant="label" style={{ fontWeight: 'bold' }}>Confirm Bank Account</Text>
                        {isLoadingBank ? (
                            <Text variant="caption">Loading bank details...</Text>
                        ) : bankAccount?.accountNumber ? (
                            <View>
                                <Text variant="body">{bankAccount.bankName}</Text>
                                <Text variant="caption">A/C: {bankAccount.accountNumber}</Text>
                                <Text variant="caption">IFSC: {bankAccount.ifscCode}</Text>
                            </View>
                        ) : (
                            <Text variant="caption" style={{ color: tokens.color.error }}>No bank account registered in profile.</Text>
                        )}
                        <Button
                            variant="secondary"
                            label="Add Another Bank Account"
                            accessibilityLabel="Add another bank account"
                            onPress={() => setUseAnotherBank(true)}
                        />
                    </Card>
                ) : (
                    <Card style={{ padding: tokens.spacing.md, gap: tokens.spacing.sm }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text variant="heading3">Another Bank Account</Text>
                            <Button variant="secondary" label="Cancel" accessibilityLabel="Cancel add bank account" onPress={() => setUseAnotherBank(false)} style={{ paddingHorizontal: 12, height: 32 }} />
                        </View>
                        <TextInput label="Bank Name" value={bankName} onChangeText={setBankName} accessibilityLabel="Bank Name Input" />
                        <TextInput label="Account Holder Name" value={accountHolderName} onChangeText={setAccountHolderName} accessibilityLabel="Account Holder Name Input" />
                        <TextInput label="Account Number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" accessibilityLabel="Account Number Input" />
                        <TextInput label="IFSC Code" value={ifscCode} onChangeText={setIfscCode} accessibilityLabel="IFSC Code Input" />
                    </Card>
                )}

                <Button
                    label="Submit Request"
                    accessibilityLabel="Submit Payout Request Button"
                    loading={isLoading}
                    onPress={handleSubmit}
                    style={{ marginTop: tokens.spacing.md }}
                />
            </ScrollView>
        </Modal>
    );
}
