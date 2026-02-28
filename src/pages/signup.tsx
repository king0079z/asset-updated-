// @ts-nocheck
import { useFormik } from 'formik';
import React, { useContext, useState, useEffect } from 'react';
import * as Yup from 'yup';
import { useRouter } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { LuLock, LuMail, LuUserPlus, LuUser } from 'react-icons/lu';
import GoogleButton from '@/components/GoogleButton';
import Logo from '@/components/Logo';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedBackground from '@/components/AnimatedBackground';
import ParticleEffect from '@/components/ParticleEffect';
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';

const SignUpPage = () => {
  const router = useRouter();
  const { initializing, signUp } = useContext(AuthContext);
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSignUp = async (e: any) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { email, password, name } = formik.values;
      await signUp(email, password);
      
      toast({
        title: "Account created successfully!",
        description: "Please check your email to verify your account.",
        duration: 5000,
      });
      
      router.push('/login');
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: "Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const validationSchema = Yup.object().shape({
    name: Yup.string().required("Name is required"),
    email: Yup.string().required("Email is required").email("Email is invalid"),
    password: Yup.string()
      .required("Password is required")
      .min(4, "Must be at least 4 characters")
      .max(40, "Must not exceed 40 characters"),
  });

  const formik = useFormik({
    initialValues: {
      name: '',
      email: '',
      password: '',
    },
    validationSchema,
    onSubmit: handleSignUp,
  });

  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSignUp(e);
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: 'spring', stiffness: 300, damping: 24 }
    }
  };

  const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { 
        type: 'spring', 
        stiffness: 300, 
        damping: 24 
      }
    },
    hover: {
      y: -5,
      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      transition: { type: 'spring', stiffness: 300, damping: 24 }
    }
  };

  const inputVariants = {
    focus: { scale: 1.02, transition: { duration: 0.2 } },
    blur: { scale: 1, transition: { duration: 0.2 } }
  };

  return (
    <AnimatedBackground>
      <ParticleEffect />
      <div className="min-h-screen flex flex-col justify-center items-center p-4">
        <motion.div 
          className="flex flex-col gap-6 w-full max-w-md"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div 
            className="w-full flex justify-center cursor-pointer" 
            onClick={() => router.push("/")}
            variants={itemVariants}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Logo />
          </motion.div>

          <motion.div 
            variants={cardVariants}
            whileHover="hover"
            initial="hidden"
            animate="visible"
          >
            <Card className="w-full border-primary/10 shadow-lg backdrop-blur-sm bg-background/80 transition-all duration-300">
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                  Create an account
                </CardTitle>
                <CardDescription className="text-center">
                  Enter your details to get started
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6" onKeyDown={handleKeyPress}>
                <motion.div 
                  className="flex flex-col gap-4"
                  variants={containerVariants}
                >
                  <motion.div 
                    variants={itemVariants}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <GoogleButton />
                  </motion.div>
                  <motion.div 
                    variants={itemVariants}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        router.push('/magic-link-login');
                      }}
                      variant="outline"
                      className="w-full relative overflow-hidden group"
                    >
                      <span className="relative z-10 flex items-center justify-center w-full">
                        <LuMail className="mr-2" />
                        Continue with Magic Link
                      </span>
                      <span className="absolute inset-0 bg-primary/5 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
                    </Button>
                  </motion.div>
                </motion.div>
                
                <div className="flex items-center w-full">
                  <Separator className="flex-1" />
                  <span className="mx-4 text-muted-foreground text-sm font-medium">or</span>
                  <Separator className="flex-1" />
                </div>

                <form onSubmit={handleSignUp} className="space-y-4">
                  <motion.div 
                    className="space-y-4"
                    variants={containerVariants}
                  >
                    <motion.div 
                      className="space-y-2" 
                      variants={itemVariants}
                    >
                      <Label htmlFor="name" className="text-sm font-medium flex items-center">
                        <LuUser className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        Full Name
                      </Label>
                      <motion.div 
                        className="relative"
                        variants={inputVariants}
                        whileFocus="focus"
                        whileTap="focus"
                      >
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <LuUser className="h-4 w-4" />
                        </div>
                        <Input
                          id="name"
                          name="name"
                          type="text"
                          placeholder="John Doe"
                          value={formik.values.name}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          className="pl-10 bg-background/50 backdrop-blur-sm border-primary/20 focus:border-primary/50 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                        />
                      </motion.div>
                      <AnimatePresence>
                        {formik.touched.name && formik.errors.name && (
                          <motion.p 
                            className="text-destructive text-xs"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                          >
                            {formik.errors.name}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    
                    <motion.div 
                      className="space-y-2" 
                      variants={itemVariants}
                    >
                      <Label htmlFor="email" className="text-sm font-medium flex items-center">
                        <LuMail className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        Email
                      </Label>
                      <motion.div 
                        className="relative"
                        variants={inputVariants}
                        whileFocus="focus"
                        whileTap="focus"
                      >
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <LuMail className="h-4 w-4" />
                        </div>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="name@example.com"
                          value={formik.values.email}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          className="pl-10 bg-background/50 backdrop-blur-sm border-primary/20 focus:border-primary/50 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                        />
                      </motion.div>
                      <AnimatePresence>
                        {formik.touched.email && formik.errors.email && (
                          <motion.p 
                            className="text-destructive text-xs"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                          >
                            {formik.errors.email}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    <motion.div 
                      className="space-y-2" 
                      variants={itemVariants}
                    >
                      <Label htmlFor="password" className="text-sm font-medium flex items-center">
                        <LuLock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        Password
                      </Label>
                      <motion.div 
                        className="relative"
                        variants={inputVariants}
                        whileFocus="focus"
                        whileTap="focus"
                      >
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <LuLock className="h-4 w-4" />
                        </div>
                        <Input
                          id="password"
                          name="password"
                          type={showPw ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={formik.values.password}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          className="pl-10 bg-background/50 backdrop-blur-sm border-primary/20 focus:border-primary/50 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPw(!showPw)}
                        >
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            {showPw
                              ? <FaEye className="h-4 w-4" />
                              : <FaEyeSlash className="h-4 w-4" />
                            }
                          </motion.div>
                        </Button>
                      </motion.div>
                      
                      {isMounted && formik.values.password && (
                        <PasswordStrengthIndicator password={formik.values.password} />
                      )}
                      
                      <AnimatePresence>
                        {formik.touched.password && formik.errors.password && (
                          <motion.p 
                            className="text-destructive text-xs"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                          >
                            {formik.errors.password}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>

                  <motion.div 
                    variants={itemVariants}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      type="submit"
                      className="w-full relative overflow-hidden group bg-primary/90 hover:bg-primary"
                      disabled={isLoading || initializing || !formik.values.email || !formik.values.password || !formik.values.name || !formik.isValid}
                      onClick={handleSignUp}
                    >
                      {isLoading ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating account...
                        </div>
                      ) : (
                        <span className="flex items-center justify-center">
                          <LuUserPlus className="mr-2 h-4 w-4" />
                          Create account
                        </span>
                      )}
                      <span className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/30 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-md"></span>
                    </Button>
                  </motion.div>
                </form>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4 pt-0">
                <div className="flex justify-center w-full text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>Already have an account?</span>
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 text-primary hover:text-primary/80"
                      onClick={() => router.push('/login')}
                    >
                      Sign in
                    </Button>
                  </div>
                </div>
                
                <motion.div 
                  className="text-xs text-center text-muted-foreground pt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  By creating an account, you agree to our Terms of Service and Privacy Policy
                </motion.div>
              </CardFooter>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </AnimatedBackground>
  );
};

export default SignUpPage;