import React, { useState } from 'react';
import { IRentACarContract } from "../interfaces/contract";
import { useStellarAccounts } from "../providers/StellarAccountProvider";
import { stellarService } from "../services/stellar.service";
import { walletService } from "../services/wallet.service";
import { ONE_XLM_IN_STROOPS } from "../utils/xml-in-stroops";
import Modal from "./modal";

interface WithdrawComissionFormProps {
  onCancel: () => void;
}

export const WithdrawAdminForm = ({onCancel}:WithdrawComissionFormProps) => {
    const [amount, setAmount] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { walletAddress, setHashId } = useStellarAccounts();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsProcessing(true);

        try {
            // Validar que el monto sea un número válido
            const amountInXLM = parseFloat(amount);
            if (isNaN(amountInXLM) || amountInXLM <= 0) {
                throw new Error('Por favor ingrese un monto válido mayor a 0');
            }

            // Convertir XLM a stroops para el contrato
            const amountInStroops = Math.floor(amountInXLM * ONE_XLM_IN_STROOPS);

            // Preparar y enviar la transacción
            const contractClient = await stellarService.buildClient<IRentACarContract>(walletAddress);
            const result = await contractClient.payout_admin({ amount: amountInStroops });
            const xdr = result.toXDR();

            const signedTx = await walletService.signTransaction(xdr);
            const txHash = await stellarService.submitTransaction(signedTx.signedTxXdr);

            setHashId(txHash as string);
            setAmount(''); // Limpiar el formulario después del éxito
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al procesar el retiro');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Modal title="Withdraw Comission" closeModal={onCancel}>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto p-4 bg-white rounded-lg shadow">
            <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                    Monto a retirar (XLM)
                </label>
                <div className="mt-1">
                    <input
                        id="amount"
                        type="number"
                        step="0.0000001" // 7 decimales para XLM
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder="0.0000000"
                        required
                        disabled={isProcessing}
                    />
                </div>
            </div>

            {error && (
                <div className="text-red-600 text-sm">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={isProcessing || !amount}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
          ${isProcessing || !amount
                        ? 'bg-indigo-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
            >
                {isProcessing ? (
                    <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Procesando...
                    </div>
                ) : (
                    'Retirar fondos'
                )}
            </button>
        </form>
        </Modal>
    );
};
