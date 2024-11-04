# OpenSK BBS Playground

## Table of Contents:

- Introduction  
- Ecosystem of Verifiable Credentials  
- Presentation Spoofing in VC  
- Our Implementation Strategy
- Tech resources we created
- References

## 1\. Introduction:

In the ecosystem of Verifiable Credentials (VC) standardized by W3C, the integrity of the claims contained within a VC can be verified by third parties through the issuer’s signature. To ensure that a VC has indeed been issued to a specific entity, there is a mechanism called binding. This binding associates the VC with the Holder’s secret key, so that only the entity possessing this secret key can legitimately present the VC. 

In this project, we implemented the binding functionality of VCs on physical hardware devices, more specifically in the form of a USB key, where the secret key is stored. This device executes cryptographic operations using the key as the binding functionality. 

We built the device using the firmware of the open-source FIDO2-compliant authenticator, OpenSK. We extended this firmware to add the blind signature functionality of BBS signatures and a zero-knowledge proof for the knowledge of the secret key. 

## 2\. Ecosystem of Verifiable Credentials:

The W3C\[1\] has established a standardized ecosystem for Verifiable Credentials that consists of three primary roles:

1. **Issuer:** The entity that creates and signs Verifiable Credentials using their private key. Issuers can be educational institutions, government agencies, or any authorized organization that issues credentials.  
2. **Holder:** The entity that receives and stores Verifiable Credentials. Holders can selectively choose which attributes to disclose and present it as Verifiable Presentations (VP).  
3. **Verifier:** The entity that receives and validates VPs. Verifiers use the Issuer's public key to verify the authenticity of the presented credentials.

Furthermore, by combining selective disclosure and unlinkability, a Holder can control which attributes they present to the Verifiers without linking them to previously presented VPs, which enhances privacy and allows users to have stronger control over their identities.

The typical process flow in this VC ecosystem proceeds as follows:

1.  The Issuer creates a Verifiable Credential by signing it with their private key and issues it to the Holder  
2.  The Holder stores the credential and can create Verifiable Presentations by selecting specific attributes to share   
3.  The Verifier receives the Verifiable Presentation and verifies the signature using the Issuer's public key

<img width="658" alt="CleanShot 2024-11-04 at 23 33 09@2x" src="https://github.com/user-attachments/assets/10749090-bfc1-469c-8e87-72ec69bfc331">

Figure1: Overview of the VC ecosystem

## 3\. Presentation Spoofing in VC and Linkability

Since the original VC ecosystem does not support binding between the issued VC and the Holder, there is a risk that the VC could be presented by someone other than the intended holder\[2\].

To verify the Holder's identity, an ID or public key can be included in the VC. When presenting the VP, the Holder reveals their public key–which is included in the VC–and proves ownership using their private key\[3\].

However, if the Holder reuses the same public key across multiple Verifiers, it enables these Verifiers to identify the Holder.

<img width="634" alt="CleanShot 2024-11-04 at 23 33 24@2x" src="https://github.com/user-attachments/assets/e4d18a84-0323-4865-bda1-479d3f6a5930">

Figure 2: Spoofing in VC

## 4\.  Our implementation Strategy

To address presentation spoofing in VC, The Holder can utilize Blind Signatures. The Holder maintains their secret key, generates a commitment of the secret key and sends it to the Issuer. The Issuer then returns a Blind Signature of the commitment of the secret key. Subsequently, the Holder can present the Verifiable Presentation, including a Zero-Knowledge Proof (ZKP) that proves the possession of a valid secret key. 

<img width="607" alt="CleanShot 2024-11-04 at 23 33 35@2x" src="https://github.com/user-attachments/assets/07c9ac87-7851-4d1d-9fe0-d4600289ce99">


Figure 3: Approach Using Blind Signatures

However, a challenge arises as the Holder must manage their secret key in binding methods. This scenario presents two main challenges in secret key management:

1. The burden of secret key management  
2. The risk of secret key leakage

To address these challenges, we implemented a USB key device to help VC Holders manage their secret keys securely, which performs binding operations within the device to mitigate secret key leakage. This device performs binding operations internally to prevent secret key leakage. Additionally, by storing the secret key and VC in separate locations, the system can prevent unintended VP presentations even if the wallet provider becomes compromised.

For our implementation, we extended the open-source FIDO authenticator firmware (OpenSK)\[4\]. Our USB key stores the VC Holder's secret key and generates commitments during VC issuance. It also supports zero-knowledge proofs of secret key ownership when presenting VPs.

<img width="402" alt="CleanShot 2024-11-04 at 23 34 47@2x" src="https://github.com/user-attachments/assets/f4a92107-58b3-477f-a643-d27409e13556">

Figure 4: USB key storing the VC Holder's secret key


## Tech resources we created

**Our OpenSK fork**

https://github.com/dorakemon/OpenSK

**ZKP for Ownership of SecretKey**

https://github.com/dorakemon/OpenSK/blob/7c02787bb450ce2eba2504bdf3879318c1fb4ccd/third_party/bbs/src/proof.rs#L34-L46

**BBS Primitives we updated**

https://github.com/dorakemon/zkryptium/tree/main/src/bbsplus

## References:

\[1\] World Wide Web Consortium : Verifiable Credentials Data Model v2.0. URL: https://www.w3.org/TR/vc-data-model-2.0/ (2024.11.03)  
\[2\] https://www.w3.org/TR/vc-data-model-2.0/#spoofing-attack  
\[3\]https://datatracker.ietf.org/doc/html/draft-ietf-oauth-selective-disclosure-jwt#name-key-binding-jwt  
\[4\] https://github.com/dorakemon/OpenSK
