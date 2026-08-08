import React from 'react';
import { Link } from 'react-router-dom';

const Company = () => {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md text-center">
        <h2 className="text-2xl font-bold text-primary mb-6">Select Ride Company</h2>
        <div className="space-y-4">
          <button className="w-full py-3 px-4 border rounded-md hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 text-left font-semibold">Uber</button>
          <button className="w-full py-3 px-4 border rounded-md hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 text-left font-semibold">Ola</button>
          <button className="w-full py-3 px-4 border rounded-md hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 text-left font-semibold">Zomato</button>
          <button className="w-full py-3 px-4 border rounded-md hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 text-left font-semibold">Swiggy</button>
        </div>
        <Link to="/dashboard" className="block mt-6 w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700">Go to Dashboard</Link>
      </div>
    </div>
  );
};

export default Company;
