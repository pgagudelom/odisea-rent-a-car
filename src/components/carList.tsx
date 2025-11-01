import React, { useState } from 'react';
import { ICar } from "../interfaces/car";
import { CarStatus } from "../interfaces/car-status";
import { IRentACarContract } from "../interfaces/contract";
import { UserRole } from "../interfaces/user-role";
import { useStellarAccounts } from "../providers/StellarAccountProvider";
import { stellarService } from "../services/stellar.service";
import { walletService } from "../services/wallet.service";
import { shortenAddress } from "../utils/shorten-address";
import { ONE_XLM_IN_STROOPS } from "../utils/xml-in-stroops";
import useModal from '../hooks/useModal';
import { WithdrawAdminForm } from './withdrawAdminForm';

interface CarsListProps {
  cars: ICar[];
}

export const CarsList = ({ cars }: CarsListProps) => {
  const { showModal, openModal, closeModal } = useModal();
  const { walletAddress, selectedRole, setHashId, setCars } =
    useStellarAccounts();

  const handleDelete = async (owner: string) => {
    const contractClient =
      await stellarService.buildClient<IRentACarContract>(walletAddress);

    const result = await contractClient.remove_car({ owner });
    const xdr = result.toXDR();

    const signedTx = await walletService.signTransaction(xdr);
    const txHash = await stellarService.submitTransaction(signedTx.signedTxXdr);

    setCars((prev) => prev.filter((car) => car.ownerAddress !== owner));
    setHashId(txHash as string);
  };

  const handleReturnCar = async (owner: string) => {
    try {
      const contractClient =
        await stellarService.buildClient<IRentACarContract>(walletAddress);

      const result = await contractClient.return_car({ owner });
      const xdr = result.toXDR();

      const signedTx = await walletService.signTransaction(xdr);
      const txHash = await stellarService.submitTransaction(signedTx.signedTxXdr);

      setCars((prev) =>
        prev.map((car) =>
          car.ownerAddress === owner
            ? { ...car, status: CarStatus.AVAILABLE }
            : car
        )
      );
      setHashId(txHash as string);
    } catch (error) {
      console.error('Error returning car:', error);
    }
  };

  const handlePayout = async (owner: string, amount: number) => {
    const contractClient =
      await stellarService.buildClient<IRentACarContract>(walletAddress);

    const result = await contractClient.payout_owner({ owner, amount });
    const xdr = result.toXDR();

    const signedTx = await walletService.signTransaction(xdr);
    const txHash = await stellarService.submitTransaction(signedTx.signedTxXdr);

    setHashId(txHash as string);
  };

  const handleRent = async (
    car: ICar,
    renter: string,
    totalDaysToRent: number
  ) => {
    const contractClient =
      await stellarService.buildClient<IRentACarContract>(walletAddress);

    const result = await contractClient.rental({
      renter,
      owner: car.ownerAddress,
      total_days_to_rent: totalDaysToRent,
      amount: car.pricePerDay * totalDaysToRent * ONE_XLM_IN_STROOPS,
    });
    const xdr = result.toXDR();

    const signedTx = await walletService.signTransaction(xdr);
    const txHash = await stellarService.submitTransaction(signedTx.signedTxXdr);

    setCars((prev) =>
      prev.map((c) =>
        c.ownerAddress === car.ownerAddress
          ? { ...c, status: CarStatus.RENTED }
          : c
      )
    );
    setHashId(txHash as string);
  };

  const getStatusStyle = (status: CarStatus) => {
    switch (status) {
      case CarStatus.AVAILABLE:
        return "px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800";
      case CarStatus.RENTED:
        return "px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800";
      case CarStatus.MAINTENANCE:
        return "px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800";
      default:
        return "px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800";
    }
  };

  const renderActionButton = (car: ICar) => {
    if (selectedRole === UserRole.ADMIN) {
      return (
        <button
          onClick={() => void handleDelete(car.ownerAddress)}
          className="px-3 py-1 bg-red-600 text-white rounded font-semibold hover:bg-red-700 transition-colors cursor-pointer"
        >
          Delete
        </button>
      );
    }

    if (selectedRole === UserRole.OWNER) {
      return (
        <div className="flex gap-2">
          {car.status === CarStatus.AVAILABLE && (
            <button
              onClick={() => void handlePayout(car.ownerAddress, car.pricePerDay * 3 * ONE_XLM_IN_STROOPS)}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Withdraw
            </button>
          )}

          {car.status === CarStatus.RENTED && (
            <button
              onClick={() => void handleReturnCar(car.ownerAddress)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Return Car
            </button>
          )}
        </div>
      );
    }

    if (
      selectedRole === UserRole.RENTER &&
      car.status === CarStatus.AVAILABLE
    ) {
      return (
        <button
          onClick={() => void handleRent(car, walletAddress, 3)}
          className="px-3 py-1 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
        >
          Rent
        </button>
      );
    }

    return null;
  };

  const [adminBalance, setAdminBalance] = useState<number>(() => {
    // Intentar obtener el balance del localStorage al iniciar
    const saved = localStorage.getItem('adminBalance');
    return saved ? Number(saved) / ONE_XLM_IN_STROOPS : 0;
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchAdminBalance = async () => {
    if (selectedRole === UserRole.ADMIN) {
      setIsUpdating(true);
      try {
        const contractClient = await stellarService.buildClient<IRentACarContract>(walletAddress);

        // Preparamos la transacción para obtener el balance y simulamos
        const txn = await contractClient.get_admin_balance();
        const scVal = await (txn as any).simulate();

        // Accedemos a la estructura correcta
        const retval = scVal?.simulation?.result?.retval;
        console.log('Full retval structure:', retval);

        // El valor está en retval._value._attributes.lo._value
        const rawValue = retval?._value?._attributes?.lo?._value;
        console.log('Found raw value:', rawValue);

        if (rawValue !== undefined) {
          // Convertimos el BigInt a Number
          const numericValue = Number(rawValue);
          console.log('Numeric value:', numericValue);

          // El valor viene en stroops, lo guardamos
          localStorage.setItem('adminBalance', numericValue.toString());

          // Convertimos de stroops a XLM para mostrar
          const balanceInXLM = numericValue / ONE_XLM_IN_STROOPS;
          console.log('Balance en stroops:', numericValue);
          console.log('Balance en XLM:', balanceInXLM);

          setAdminBalance(balanceInXLM);
        } else {
          console.error('No se pudo obtener el valor del balance de la simulación');
          console.log('Estructura de simulation:', scVal?.simulation);
          console.log('Estructura de result:', scVal?.simulation?.result);
          console.log('Estructura de retval:', scVal?.simulation?.result?.retval);
        }
      } catch (error) {
        console.error('Error fetching admin balance:', error);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  // No necesitamos el useEffect ya que solo queremos que se actualice con el botón

  return (
    <div data-test="cars-list">
      <div>
        {selectedRole === UserRole.ADMIN && (
          <div className="mb-4 px-4 py-3 bg-white shadow-sm rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-gray-700 font-medium">Admin commission balance:</h2>
              {isUpdating && (
                <svg className="animate-spin h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <button
                onClick={() => void fetchAdminBalance()}
                className="ml-2 px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                disabled={isUpdating}
              >
                Refresh Balance
              </button>
              {selectedRole === UserRole.ADMIN && (
                <button
                  onClick={openModal}
                  className="ml-2 px-3 py-1 text-sm bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
                >
                  <span className="flex items-center gap-2">Withdraw comission</span>
                </button>
              )}
            </div>
            <p className="text-lg font-semibold text-indigo-600">{adminBalance.toFixed(7)} XLM</p>
          </div>
        )}
        <table className="min-w-full bg-white shadow-md rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Brand
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Model
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Color
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Passengers
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                A/C
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price/Day
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Admin Fee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cars.map((car, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {car.brand}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {car.model}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {car.color}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {car.passengers}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {car.ac ? (
                    <span className="text-green-600">Yes</span>
                  ) : (
                    <span className="text-red-600">No</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {shortenAddress(car.ownerAddress)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${car.pricePerDay}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <span className="font-medium text-indigo-600">{car.adminCommission}%</span>
                    {car.adminCommission > 0 && (
                      <span className="ml-2 text-xs text-gray-500">
                        (+${((car.pricePerDay * car.adminCommission) / 100).toFixed(2)})
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={getStatusStyle(car.status)}>
                    {car.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {renderActionButton(car)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <WithdrawAdminForm onCancel={closeModal} />
      )}
    </div>
  );
};