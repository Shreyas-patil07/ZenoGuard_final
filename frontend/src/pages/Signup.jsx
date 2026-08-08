import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const Signup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    console.log("Frontend: Submitting signup form with data:", formData);
    
    try {
      const response = await axios.post('http://localhost:8000/auth/signup', formData);
      console.log("Frontend: Received success response:", response.data);
      navigate('/kyc');
    } catch (error) {
      console.error("Frontend: Signup error:", error.response ? error.response.data : error.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-primary mb-6">GigShield Signup</h2>
        <form className="space-y-4" onSubmit={handleSignup}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Enter name" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Enter email" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Create password" required />
          </div>
          <button type="submit" className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700">Sign Up</button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
