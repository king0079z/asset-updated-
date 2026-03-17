import React, { useContext, useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useRouter } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { LuMail, LuArrowRight, LuCheckCircle } from 'react-icons/lu';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedBackground from '@/components/AnimatedBackground';
import ParticleEffect from '@/components/ParticleEffect';

interface FormValues {
  email: string;
}

const MagicLinkLoginPage = () => {
  const router = useRouter();
  const { initializing, signInWithMagicLink } = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogin = async (values: FormValues) => {
    setIsLoading(true);
    try {
      await signInWithMagicLink(values.email);
      setEmailSent(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const validationSchema = Yup.object().shape({
    email: Yup.string().required("Email is required").email("Email is invalid"),
  });

  const formik = useFormik<FormValues>({
    initialValues: {
      email: '',
    },
    validationSchema,
    onSubmit: handleLogin,
  });

  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      formik.handleSubmit();
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

  const successIconVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: { 
        type: 'spring', 
        stiffness: 300, 
        damping: 15,
        delay: 0.2
      }
    }
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
                  Magic Link Login
                </CardTitle>
                <CardDescription className="text-center">
                  {emailSent 
                    ? "Check your email for the login link" 
                    : "Enter your email to receive a magic link"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6" onKeyDown={handleKeyPress}>
                <AnimatePresence mode="wait">
                  {emailSent ? (
                    <motion.div 
                      className="flex flex-col items-center gap-6 py-6"
                      key="success"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.5 }}
                    >
                      <motion.div 
                        className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center"
                        variants={successIconVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        <LuCheckCircle className="h-10 w-10 text-primary" />
                      </motion.div>
                      <motion.div 
                        className="text-center space-y-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        <p className="text-lg font-medium">Magic link sent!</p>
                        <p className="text-sm text-muted-foreground max-w-xs">
                          We've sent a magic link to <span className="font-medium text-foreground">{formik.values.email}</span>. 
                          Click the link in the email to sign in.
                        </p>
                      </motion.div>
                      
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                      >
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-4"
                          onClick={() => setEmailSent(false)}
                        >
                          Use a different email
                        </Button>
                      </motion.div>
                    </motion.div>
                  ) : (
                    <motion.form 
                      onSubmit={formik.handleSubmit} 
                      className="space-y-4"
                      key="form"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <motion.div 
                        className="space-y-4"
                        variants={containerVariants}
                      >
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
                      </motion.div>

                      <motion.div 
                        variants={itemVariants}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button
                          type="submit"
                          className="w-full relative overflow-hidden group bg-primary/90 hover:bg-primary"
                          disabled={isLoading || initializing || !formik.values.email || !formik.isValid}
                        >
                          {isLoading ? (
                            <div className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Sending...
                            </div>
                          ) : (
                            <span className="flex items-center justify-center">
                              <LuMail className="mr-2 h-4 w-4" />
                              Send Magic Link
                            </span>
                          )}
                          <span className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/30 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-md"></span>
                        </Button>
                      </motion.div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4 pt-0">
                <div className="flex justify-center w-full text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 flex items-center text-primary hover:text-primary/80"
                      onClick={() => router.push('/login')}
                    >
                      <span>Back to Login</span>
                      <LuArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <motion.div 
                  className="text-xs text-center text-muted-foreground pt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  Need an account? <a onClick={() => router.push('/signup')} className="text-primary hover:text-primary/80 hover:underline cursor-pointer">Sign up</a>
                </motion.div>
              </CardFooter>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </AnimatedBackground>
  );
};

export default MagicLinkLoginPage;