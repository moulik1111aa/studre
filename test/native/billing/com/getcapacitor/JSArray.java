package com.getcapacitor; public class JSArray extends java.util.ArrayList<Object> { public JSArray put(Object o){ add(o); return this; } public int length(){ return size(); } }
