#include<iostream>
#include<fstream>
#include "frequency.h"

using namespace std;

bool calculateFrequency(string filename, int frequency[256]){
    for(int i=0;i<256;i++){
        frequency[i]=0;
    }

    ifstream file(filename, ios::binary);

    if(!file){
        cout<<"File cannot be opened"<<endl;
        return false;
    }
    unsigned char ch;

    while(file.read((char*)&ch,1)){
        frequency[ch]++;
    }

    file.close();

    return true;
}

void displayFrequency(int frequency[256]){
    cout<<"Frequency Table:"<<endl;

    for(int i=0;i<256;i++){
        if(frequency[i]!=0){
            cout<<"Byte "<<i<<" : "<<frequency[i]<<endl;
        }
    }
}