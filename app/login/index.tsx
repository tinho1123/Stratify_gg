import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import logo from "../../assets/images/logo.png";

export default function Login() {
  const [email, setEmail] = useState<string>("");
  const [senha, setSenha] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  async function handleLogin(){
    try {
      setLoading(true);
      if (!email || !senha) {
        return Alert.alert("Erro", "Por favor, preencha todos os campos.");
      }
      setTimeout(() => {
        
      }, 3000);

      Alert.alert("Sucesso", "Login realizado com sucesso!");

    } catch (error) {
      Alert.alert("Erro", "Ocorreu um erro ao tentar fazer login."); 
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.boxtop}>
        <Image style={styles.logo} source={logo} />
        <Text style={styles.title}>Bem-vindo</Text>
      </View>

      <View style={styles.boxmid}>
        <Text style={styles.titleInput}>EMAIL:</Text>
        <View style={styles.boxInput}>
          <TextInput
           style={styles.input}
           value={email}
           onChangeText={setEmail}
           />
          <MaterialIcons name="email" size={24} color="white" />
        </View>
        <Text style={styles.titleInput}>SENHA:</Text>
        <View style={styles.boxInput}>
          <TextInput
           style={styles.input}
           value={senha}
           onChangeText={setSenha}
          />
          <MaterialIcons name="remove-red-eye" size={24} color="white" />
        </View>
      </View>
      
      <View style={styles.boxbottom}>
        <TouchableOpacity 
          style={styles.button}
          onPress={handleLogin}
          > {
            loading? 
              <ActivityIndicator color="white" size="small"  /> 
            :
              <Text style={styles.textButton}>Entrar</Text>
          }
        </TouchableOpacity>
      </View>
      <Text style={styles.textButton}>Não tem conta? <Text style={styles.textButtonCreate}>Crie agora!</Text></Text>
    </View>
  );
}

const styles = StyleSheet.create({
 container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0c131b",
  },  
  boxtop: {
    height:Dimensions.get("window").height / 3,
    width: "100%",
    backgroundColor: "#0c131b",
    alignItems: "center",
    justifyContent: "center",
  }, 
  logo: {
    width: 150,
    height: 150,
    alignSelf: "center",
    marginTop: 100,
  },
  boxmid: {
    height:Dimensions.get("window").height / 4,
    width: "100%",
    backgroundColor: "#0c131b",
    paddingHorizontal: 27,
  },
  boxbottom: {
    height:Dimensions.get("window").height / 3,
    width: "100%",
    backgroundColor: "#0c131b",
    alignItems: "center",
  }, title: {
    fontSize: 24,
    fontWeight: "bold", 
    marginTop: 20,
    color: "white",
  }, titleInput: {
    fontSize: 18,
    marginLeft: 10,
    marginTop: 10,
    color: "white",
  }, boxInput: {
    width: "100%",
    height: 50,
    borderRadius: 27,
    borderWidth: 1,
    marginTop: 10,
    flexDirection: "row",
    borderColor: "white",
    alignItems: "center",
    paddingHorizontal: 15,
    backgroundColor: "#19232e",
  }, input: {
    width: "90%",
    height: "100%",
    color: "white",
  }, button: {
    width: 250,
    height: 50,
    backgroundColor: "#0b8b3cff",
    alignItems: "center",
    justifyContent: "center", 
    borderRadius: 40,
    shadowColor: "#ffffffff",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.29,
    shadowRadius: 4.65,
    elevation: 5,
  }, textButton: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold", 
  },textButtonCreate: {
    color: "#6b81fcff",
    fontSize: 18,
    fontWeight: "bold",
  },

});
